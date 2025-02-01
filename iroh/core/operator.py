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
from .command_parser import CommandParser
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
        self.commands: Optional[CommandParser] = None
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
            config_path = "config/config.yml"
            commands_path = "config/commands.yml"
            
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
            self.commands = CommandParser()
            self.phone = PhoneManager(self.config)
            
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
            
            # Parse event into command
            command = await self.commands.parse_sequence([event])
            
            if command:
                # Log command if debugging enabled
                if self.config.get("debug.log_commands", False):
                    self.debug.log_command(command.name, command.args)
                
                # Execute command
                await self._execute_command(command)
            
            # Log state change if debugging enabled
            if self.config.get("debug.log_state_changes", False):
                new_state = self.state.get_state() if self.state else {}
                self.debug.log_state_change(old_state, new_state)
            
        except Exception as e:
            logger.error(f"Error processing event: {str(e)}", exc_info=True)
            
            # Provide audio feedback for error
            if self.audio:
                await self.audio.speak("Sorry, there was an error processing that command")
    
    async def _execute_command(self, command: Any) -> None:
        """
        Execute a parsed command
        
        Args:
            command: Command object to execute
        """
        try:
            # Update state
            if self.state:
                self.state.set_last_command(command)
            
            # Handle different command types
            if command.name == "quick_timer":
                await self.timers.quick_timer(command.args.get("minutes", 1))
            
            elif command.name == "service":
                await self.home_assistant.handle_command(command)
            
            elif command.name == "voice":
                await self.audio.start_voice_recognition()
            
            else:
                logger.warning(f"Unknown command type: {command.name}")
                
        except Exception as e:
            logger.error(f"Error executing command: {str(e)}", exc_info=True)
            raise

# Example usage:
#
# operator = IrohOperator()
# await operator.start()
# # System runs...
# await operator.shutdown()
