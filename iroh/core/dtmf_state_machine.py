# File: iroh/core/dtmf_state_machine.py
# State machine implementation for DTMF command processing
# Handles state transitions and command execution based on dtmf_commands.yml

import re
import yaml
import asyncio
from typing import Dict, List, Optional, Any, Callable
from dataclasses import dataclass
from pathlib import Path

from ..utils.logger import get_logger
from ..utils.config import Config

logger = get_logger(__name__)

@dataclass
class DTMFEvent:
    """Represents a DTMF input event"""
    type: str  # 'digit', 'star', 'hash'
    value: str
    timestamp: float

@dataclass
class StateHandler:
    """Represents a command handler within a state"""
    type: str
    pattern: str
    description: str
    action: Dict[str, Any]
    terminator: Optional[str] = None
    next_state: Optional[str] = None

@dataclass
class State:
    """Represents a state in the DTMF state machine"""
    name: str
    description: str
    handlers: List[StateHandler]
    timeout: int
    on_enter: List[str]
    on_timeout: Optional[str] = None
    on_invalid: Optional[str] = None

class DTMFStateMachine:
    """
    State machine for processing DTMF commands based on configuration
    """
    def __init__(self, config_path: str = "config/dtmf_commands.yml"):
        self.config_path = Path(config_path)
        self.current_state: Optional[State] = None
        self.buffer: List[DTMFEvent] = []
        self.timeout_task: Optional[asyncio.Task] = None
        self.handlers: Dict[str, Callable] = {}
        self.transformers: Dict[str, Callable] = {}
        
        # Load configuration
        self._load_config()
        
        logger.debug("DTMFStateMachine initialized")
    
    def _load_config(self) -> None:
        """Load and parse the DTMF command configuration"""
        try:
            with open(self.config_path) as f:
                self.config = yaml.safe_load(f)
            
            # Parse states
            self.states = {}
            for name, state_config in self.config["states"].items():
                handlers = []
                for handler_config in state_config.get("handlers", []):
                    handlers.append(StateHandler(
                        type=handler_config.get("type", "pattern"),
                        pattern=handler_config["pattern"],
                        description=handler_config.get("description", ""),
                        action=handler_config.get("action", {}),
                        terminator=handler_config.get("terminator"),
                        next_state=handler_config.get("next_state")
                    ))
                
                self.states[name] = State(
                    name=name,
                    description=state_config.get("description", ""),
                    handlers=handlers,
                    timeout=state_config.get("timeout", 
                                          self.config["settings"]["default_timeout"]),
                    on_enter=state_config.get("on_enter", []),
                    on_timeout=state_config.get("on_timeout"),
                    on_invalid=state_config.get("on_invalid")
                )
            
            logger.info(f"Loaded {len(self.states)} states from configuration")
            
        except Exception as e:
            logger.error(f"Failed to load DTMF configuration: {str(e)}", exc_info=True)
            raise
    
    def register_handler(self, name: str, handler: Callable) -> None:
        """Register a command handler function"""
        self.handlers[name] = handler
        logger.debug(f"Registered handler: {name}")
    
    def register_transformer(self, name: str, transformer: Callable) -> None:
        """Register an input transformer function"""
        self.transformers[name] = transformer
        logger.debug(f"Registered transformer: {name}")
    
    async def start(self) -> None:
        """Start the state machine in the initial state"""
        await self.transition_to("initial")
    
    async def transition_to(self, state_name: str) -> None:
        """
        Transition to a new state
        
        Args:
            state_name: Name of state to transition to
        """
        if state_name not in self.states:
            logger.error(f"Invalid state: {state_name}")
            return
        
        # Cancel any existing timeout
        if self.timeout_task:
            self.timeout_task.cancel()
        
        # Clear input buffer
        self.buffer.clear()
        
        # Set new state
        self.current_state = self.states[state_name]
        
        # Start timeout task
        self.timeout_task = asyncio.create_task(
            self._handle_timeout(self.current_state.timeout)
        )
        
        # Execute on_enter handlers
        for handler_name in self.current_state.on_enter:
            if handler := self.handlers.get(handler_name):
                try:
                    await handler()
                except Exception as e:
                    logger.error(f"Error in on_enter handler: {str(e)}", exc_info=True)
        
        logger.info(f"Transitioned to state: {state_name}")
    
    async def handle_event(self, event_type: str, value: str) -> None:
        """
        Handle a DTMF input event
        
        Args:
            event_type: Type of event ('digit', 'star', 'hash')
            value: Event value
        """
        if not self.current_state:
            logger.error("No current state")
            return
        
        # Add event to buffer
        event = DTMFEvent(
            type=event_type,
            value=value,
            timestamp=asyncio.get_event_loop().time()
        )
        self.buffer.append(event)
        
        # Check for matches
        for handler in self.current_state.handlers:
            if await self._check_handler_match(handler):
                # Reset timeout
                if self.timeout_task:
                    self.timeout_task.cancel()
                self.timeout_task = asyncio.create_task(
                    self._handle_timeout(self.current_state.timeout)
                )
                return
        
        # Handle invalid input
        if self.current_state.on_invalid:
            await self.transition_to(self.current_state.on_invalid)
    
    async def _check_handler_match(self, handler: StateHandler) -> bool:
        """
        Check if current input matches a handler pattern
        
        Args:
            handler: Handler to check
            
        Returns:
            True if pattern matches and action was executed
        """
        try:
            # Build input string from buffer
            input_str = "".join(e.value for e in self.buffer)
            
            # Check pattern match
            if not re.match(f"^{handler.pattern}$", input_str):
                return False
            
            # Check terminator if required
            if handler.terminator:
                if not input_str.endswith(handler.terminator):
                    return False
                # Remove terminator for action processing
                input_str = input_str[:-len(handler.terminator)]
            
            # Execute action
            if action := handler.action:
                if handler_name := action.get("handler"):
                    if handler_func := self.handlers.get(handler_name):
                        # Transform input if specified
                        if transform := action.get("transform"):
                            if transformer := self.transformers.get(transform):
                                input_str = transformer(input_str)
                        
                        # Execute handler with args
                        args = action.get("args", {})
                        await handler_func(input_str, **args)
                    else:
                        logger.error(f"Handler not found: {handler_name}")
            
            # Transition to next state if specified
            if handler.next_state:
                await self.transition_to(handler.next_state)
            
            return True
            
        except Exception as e:
            logger.error(f"Error checking handler match: {str(e)}", exc_info=True)
            return False
    
    async def _handle_timeout(self, timeout: int) -> None:
        """
        Handle state timeout
        
        Args:
            timeout: Timeout in milliseconds
        """
        try:
            await asyncio.sleep(timeout / 1000)  # Convert to seconds
            
            if self.current_state and self.current_state.on_timeout:
                await self.transition_to(self.current_state.on_timeout)
                
        except asyncio.CancelledError:
            pass  # Normal cancellation
        except Exception as e:
            logger.error(f"Error in timeout handler: {str(e)}", exc_info=True)

# Example transformers
def minutes_from_digits(digits: str) -> int:
    """Convert digit string to minutes"""
    return int(digits)

def temperature_from_digits(digits: str) -> int:
    """Convert digit string to temperature, ensuring it's in valid range"""
    temp = int(digits)
    if not (60 <= temp <= 85):
        raise ValueError(f"Temperature {temp} outside valid range (60-85)")
    return temp

# Example usage:
#
# # Create state machine
# state_machine = DTMFStateMachine()
#
# # Register handlers
# state_machine.register_handler("timer_manager.create_timer", 
#                              timer_manager.create_timer)
# state_machine.register_handler("home_assistant.lights_on",
#                              home_assistant.lights_on)
#
# # Register transformers
# state_machine.register_transformer("minutes_from_digits", 
#                                  minutes_from_digits)
# state_machine.register_transformer("temperature_from_digits",
#                                  temperature_from_digits)
#
# # Start machine
# await state_machine.start()
#
# # Handle events
# await state_machine.handle_event("digit", "1")
# await state_machine.handle_event("hash", "#")
