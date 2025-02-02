# File: iroh/core/phone_manager.py
# Phone event handling and DTMF command processing for the Iroh Home Management System

import asyncio
import json
import websockets
from typing import Optional, Dict, Any, AsyncGenerator

from ..utils.logger import get_logger
from ..utils.config import Config
from .dtmf_state_machine import DTMFStateMachine
from .timer_manager import TimerManager
from ..services.audio_service import AudioService
from ..services.home_assistant import HomeAssistantService

logger = get_logger(__name__)

class PhoneError(Exception):
    """Custom exception for phone-related errors"""
    pass

class PhoneManager:
    """
    Manages phone events and DTMF command processing through the Phone API Server
    """
    def __init__(
        self,
        timer_manager: TimerManager,
        audio_service: AudioService,
        home_assistant: HomeAssistantService,
        config: Config
    ):
        self.timer_manager = timer_manager
        self.audio = audio_service
        self.home_assistant = home_assistant
        self.config = config
        
        # Initialize state machine
        self.dtmf_machine = DTMFStateMachine("iroh/config/dtmf_commands.yml")
        self._setup_handlers()
        
        # Track phone state
        self.off_hook = False
        self._ws = None
        self._running = False
        
        # Get API configuration
        self.rest_url = config.get("phone.api.rest_url", "http://localhost:8000")
        self.ws_url = config.get("phone.api.ws_url", "ws://localhost:8001/ws")
        
        logger.debug("PhoneManager initialized")
    
    async def connect(self) -> None:
        """Connect to the phone API server"""
        try:
            # Connect WebSocket
            self._ws = await websockets.connect(self.ws_url)
            self._running = True
            
            # Start event processing
            asyncio.create_task(self._event_loop())
            
            logger.info("Connected to phone API server")
            
        except Exception as e:
            logger.warning(
                "Phone API running in degraded mode - "
                "phone features will be unavailable"
            )
            logger.error(f"Failed to connect to phone API: {str(e)}", exc_info=True)
            # Don't raise the error, allow system to continue in degraded mode
    
    async def disconnect(self) -> None:
        """Disconnect from the phone API server"""
        self._running = False
        if self._ws:
            await self._ws.close()
            self._ws = None
        logger.info("Disconnected from phone API server")
    
    async def _event_loop(self) -> None:
        """Process WebSocket events"""
        while self._running and self._ws:
            try:
                message = await self._ws.recv()
                event = json.loads(message)
                await self.handle_phone_event(event)
                
            except websockets.ConnectionClosed:
                logger.error("WebSocket connection closed")
                await self.disconnect()
                break
                
            except Exception as e:
                logger.error(f"Error in event loop: {str(e)}", exc_info=True)
                await asyncio.sleep(1)  # Prevent tight error loop
    
    def _setup_handlers(self) -> None:
        """Register command handlers with state machine"""
        try:
            # Timer handlers
            self.dtmf_machine.register_handler(
                "timer_manager.create_timer",
                self._handle_timer_creation
            )
            self.dtmf_machine.register_handler(
                "timer_manager.announce_timers",
                self.timer_manager.announce_timers
            )
            
            # Home Assistant handlers
            self.dtmf_machine.register_handler(
                "home_assistant.lights_on",
                self._handle_lights_on
            )
            self.dtmf_machine.register_handler(
                "home_assistant.lights_off",
                self._handle_lights_off
            )
            self.dtmf_machine.register_handler(
                "home_assistant.set_temperature",
                self._handle_set_temperature
            )
            
            # Register transformers
            self.dtmf_machine.register_transformer(
                "minutes_from_digits",
                self._transform_minutes
            )
            self.dtmf_machine.register_transformer(
                "temperature_from_digits",
                self._transform_temperature
            )
            
            logger.debug("Command handlers registered")
            
        except Exception as e:
            logger.error(f"Failed to setup handlers: {str(e)}", exc_info=True)
            raise
    
    async def handle_phone_event(self, event: Dict[str, Any]) -> None:
        """
        Handle phone events (off hook, on hook, DTMF)
        
        Args:
            event: Phone event dictionary
        """
        try:
            event_type = event.get("type")
            
            if event_type == "off_hook":
                await self._handle_off_hook()
            elif event_type == "on_hook":
                await self._handle_on_hook()
            elif event_type == "dtmf":
                await self._handle_dtmf(event.get("digit", ""))
            else:
                logger.warning(f"Unknown event type: {event_type}")
            
        except Exception as e:
            logger.error(f"Error handling phone event: {str(e)}", exc_info=True)
    
    async def _handle_off_hook(self) -> None:
        """Handle phone off hook event"""
        try:
            self.off_hook = True
            
            # Start DTMF state machine
            await self.dtmf_machine.start()
            
            logger.debug("Phone off hook")
            
        except Exception as e:
            logger.error(f"Error handling off hook: {str(e)}", exc_info=True)
    
    async def _handle_on_hook(self) -> None:
        """Handle phone on hook event"""
        try:
            self.off_hook = False
            logger.debug("Phone on hook")
            
        except Exception as e:
            logger.error(f"Error handling on hook: {str(e)}", exc_info=True)
    
    async def _handle_dtmf(self, digit: str) -> None:
        """
        Handle DTMF digit event
        
        Args:
            digit: DTMF digit received
        """
        try:
            if not self.off_hook:
                logger.warning("Received DTMF while on hook")
                return
            
            # Determine event type
            if digit == "*":
                event_type = "star"
            elif digit == "#":
                event_type = "hash"
            else:
                event_type = "digit"
            
            # Pass to state machine
            await self.dtmf_machine.handle_event(event_type, digit)
            
        except Exception as e:
            logger.error(f"Error handling DTMF: {str(e)}", exc_info=True)
    
    # Command Handlers
    
    async def _handle_timer_creation(self, minutes: int, **kwargs) -> None:
        """Create a timer from DTMF input"""
        try:
            await self.timer_manager.quick_timer(minutes)
        except Exception as e:
            logger.error(f"Error creating timer: {str(e)}", exc_info=True)
            await self.audio.speak("Failed to create timer")
    
    async def _handle_lights_on(self, input_str: str, entity: str) -> None:
        """Turn on lights"""
        try:
            await self.home_assistant.lights_on(input_str, entity)
            await self.audio.speak("Lights turned on")
        except Exception as e:
            logger.error(f"Error turning lights on: {str(e)}", exc_info=True)
            await self.audio.speak("Failed to turn on lights")
    
    async def _handle_lights_off(self, input_str: str, entity: str) -> None:
        """Turn off lights"""
        try:
            await self.home_assistant.lights_off(input_str, entity)
            await self.audio.speak("Lights turned off")
        except Exception as e:
            logger.error(f"Error turning lights off: {str(e)}", exc_info=True)
            await self.audio.speak("Failed to turn off lights")
    
    async def _handle_set_temperature(
        self,
        temperature: int,
        entity: str
    ) -> None:
        """Set thermostat temperature"""
        try:
            await self.home_assistant.set_temperature(str(temperature), entity)
            await self.audio.speak(f"Temperature set to {temperature} degrees")
        except Exception as e:
            logger.error(f"Error setting temperature: {str(e)}", exc_info=True)
            await self.audio.speak("Failed to set temperature")
    
    # Transformers
    
    def _transform_minutes(self, digits: str) -> int:
        """Convert digit string to minutes"""
        try:
            minutes = int(digits)
            if not 1 <= minutes <= 999:
                raise ValueError("Minutes must be between 1 and 999")
            return minutes
        except ValueError as e:
            logger.error(f"Invalid minutes value: {str(e)}")
            raise
    
    def _transform_temperature(self, digits: str) -> int:
        """Convert digit string to temperature"""
        try:
            temp = int(digits)
            if not 60 <= temp <= 85:
                raise ValueError("Temperature must be between 60 and 85")
            return temp
        except ValueError as e:
            logger.error(f"Invalid temperature value: {str(e)}")
            raise

# Example usage:
#
# phone_manager = PhoneManager(
#     timer_manager=timer_manager,
#     audio_service=audio_service,
#     home_assistant=home_assistant,
#     config=config
# )
#
# # Handle phone events
# await phone_manager.handle_phone_event({
#     "type": "off_hook"
# })
#
# await phone_manager.handle_phone_event({
#     "type": "dtmf",
#     "digit": "5"
# })
#
# await phone_manager.handle_phone_event({
#     "type": "dtmf",
#     "digit": "#"
# })
