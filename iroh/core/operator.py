# File: iroh/core/operator.py
# Main system coordinator for the Iroh Home Management System
# Manages all core components and handles system-wide operations

import asyncio
import time
from typing import Optional, Dict, Any

from ..utils.logger import get_logger
from ..utils.config import Config
from ..utils.debug import DebugUtils
from .phone_manager import PhoneManager
from .timer_manager import TimerManager
from .dtmf_state_machine import DTMFStateMachine
from .state_manager import StateManager
from ..services.audio_service import AudioService
from ..services.notification import NotificationService
from ..services.home_assistant import HomeAssistantService

logger = get_logger(__name__)

class IrohOperator:
    """
    Main system coordinator that manages all core components and handles system-wide operations
    """
    def __init__(self):
        self.config = Config()
        self.debug = DebugUtils()
        
        # Core components
        self.phone: Optional[PhoneManager] = None
        self.timers: Optional[TimerManager] = None
        self.state_machine: Optional[DTMFStateMachine] = None
        self.state: Optional[StateManager] = None
        
        # Services
        self.audio: Optional[AudioService] = None
        self.notifier: Optional[NotificationService] = None
        self.home_assistant: Optional[HomeAssistantService] = None
        
        # Internal state
        self._running = False
        self._event_queue: asyncio.Queue = asyncio.Queue()
        
        logger.debug("IrohOperator initialized")
    
    async def start(self) -> None:
        """
        Initialize and start all system components
        """
        try:
            logger.info("Starting Iroh system...")
            
            # Load configuration
            await self._load_configuration()
            
            # Initialize components
            await self._initialize_components()
            
            # Start debug monitoring if enabled
            if self.config.get("system.debug_mode", False):
                self.debug.start_monitoring()
            
            # Start event processing
            self._running = True
            asyncio.create_task(self._event_loop())
            
            logger.info("Iroh system started successfully")
            
        except Exception as e:
            logger.error(f"Failed to start system: {str(e)}", exc_info=True)
            raise
    
    async def shutdown(self) -> None:
        """
        Gracefully shutdown the system
        """
        logger.info("Initiating system shutdown...")
        
        # Stop event processing
        self._running = False
        
        # Stop debug monitoring
        self.debug.stop_monitoring()
        
        # Shutdown components
        if self.phone:
            await self.phone.disconnect()
        
        if self.home_assistant:
            await self.home_assistant.disconnect()
        
        # Final cleanup
        await self._event_queue.join()
        logger.info("System shutdown complete")
    
    async def _load_configuration(self) -> None:
        """Load and validate system configuration"""
        try:
            config_path = "iroh/config/config.yml"
            commands_path = "iroh/config/commands.yml"
            
            logger.debug(f"Loading configuration from {config_path} and {commands_path}")
            await self.config.load(config_path, commands_path)
            
        except Exception as e:
            logger.error(f"Failed to load configuration: {str(e)}", exc_info=True)
            raise
    
    async def _initialize_components(self) -> None:
        """Initialize all system components"""
        try:
            # Initialize services first
            self.audio = AudioService(self.config)
            self.notifier = NotificationService(self.config)
            self.home_assistant = HomeAssistantService(self.config)
            
            # Initialize core components
            self.state = StateManager()
            self.timers = TimerManager(self.audio)
            self.state_machine = DTMFStateMachine("iroh/config/dtmf_commands.yml")
            
            # Register state machine handlers
            self.state_machine.register_handler("timer_manager.quick_timer", 
                                             self.timers.quick_timer)
            # Register Home Assistant handlers
            self.state_machine.register_handler("home_assistant.lights_on",
                                             self.home_assistant.lights_on)
            self.state_machine.register_handler("home_assistant.lights_off",
                                             self.home_assistant.lights_off)
            self.state_machine.register_handler("home_assistant.set_temperature",
                                             self.home_assistant.set_temperature)
            
            # Start state machine
            await self.state_machine.start()
            
            # Initialize phone manager
            self.phone = PhoneManager(
                timer_manager=self.timers,
                audio_service=self.audio,
                home_assistant=self.home_assistant,
                config=self.config
            )
            
            # Connect required services
            await self.home_assistant.connect()
            await self.phone.connect()
            
            logger.debug("All components initialized successfully")
            
        except Exception as e:
            logger.error(f"Failed to initialize components: {str(e)}", exc_info=True)
            raise
    
    async def _event_loop(self) -> None:
        """Main event processing loop"""
        logger.debug("Starting event processing loop")
        
        while self._running:
            try:
                # Process phone events
                async for event in self.phone.events():
                    start_time = time.time()
                    
                    # Log event if debugging enabled
                    if self.config.get("debug.log_events", False):
                        self.debug.log_command("phone_event", {"event": event})
                    
                    # Process the event
                    await self._process_event(event)
                    
                    # Measure processing latency
                    self.debug.measure_latency(start_time)
                    
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in event loop: {str(e)}", exc_info=True)
                await asyncio.sleep(1)  # Prevent tight error loop
    
    async def _process_event(self, event: Dict[str, Any]) -> None:
        """
        Process a system event
        
        Args:
            event: Event dictionary containing event type and data
        """
        try:
            # Get old state for logging
            old_state = self.state.get_state() if self.state else {}
            
            # Process event through state machine
            if self.state_machine:
                # Log event if debugging enabled
                if self.config.get("debug.log_commands", False):
                    self.debug.log_command("state_machine_event", event)
                
                # Process event through state machine
                await self.state_machine.handle_event(event.get("type", ""), event.get("value", ""))
                # Note: State machine handles actions internally through registered handlers
                
            
            # Log state change if debugging enabled
            if self.config.get("debug.log_state_changes", False):
                new_state = self.state.get_state() if self.state else {}
                self.debug.log_state_change(old_state, new_state)
            
        except Exception as e:
            logger.error(f"Error processing event: {str(e)}", exc_info=True)
            
            # Provide audio feedback for error
            if self.audio:
                await self.audio.speak("Sorry, there was an error processing that command")
    
# Example usage:
#
# operator = IrohOperator()
# await operator.start()
# # System runs...
# await operator.shutdown()
