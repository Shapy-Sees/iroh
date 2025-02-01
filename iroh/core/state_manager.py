# File: iroh/core/state_manager.py
# System state tracking for the Iroh Home Management System
# Manages system state and provides debugging support

from datetime import datetime
from typing import Dict, Any, Optional, List

from ..utils.logger import get_logger

logger = get_logger(__name__)

class StateError(Exception):
    """Custom exception for state-related errors"""
    pass

class StateManager:
    """
    Manages system state tracking with debugging support
    """
    def __init__(self):
        # Core state
        self.current_state = "idle"
        self.previous_state = None
        self.state_change_time = datetime.now()
        
        # Component states
        self.phone_state = "idle"
        self.active_timers: Dict[str, Dict[str, Any]] = {}
        self.last_command: Optional[Dict[str, Any]] = None
        
        # Service states
        self.home_assistant_connected = False
        self.audio_active = False
        self.voice_recognition_active = False
        
        # Debug information
        self.debug_info: Dict[str, Any] = {
            "state_changes": [],
            "command_history": [],
            "error_log": [],
            "performance_metrics": {
                "command_latency": [],
                "state_transitions": []
            }
        }
        
        # State transition validation
        self.valid_transitions = {
            "idle": ["processing", "error"],
            "processing": ["idle", "error"],
            "error": ["idle"]
        }
        
        logger.debug("StateManager initialized")
    
    def set_state(self, new_state: str) -> None:
        """
        Set system state with validation
        
        Args:
            new_state: New state to set
            
        Raises:
            StateError: If state transition is invalid
        """
        try:
            # Validate state transition
            if new_state not in self.valid_transitions.get(self.current_state, []):
                raise StateError(
                    f"Invalid state transition: {self.current_state} -> {new_state}"
                )
            
            # Record state change
            timestamp = datetime.now()
            state_change = {
                "from_state": self.current_state,
                "to_state": new_state,
                "timestamp": timestamp.isoformat(),
                "duration": (timestamp - self.state_change_time).total_seconds()
            }
            
            # Update state
            self.previous_state = self.current_state
            self.current_state = new_state
            self.state_change_time = timestamp
            
            # Log state change
            self.debug_info["state_changes"].append(state_change)
            if len(self.debug_info["state_changes"]) > 100:
                self.debug_info["state_changes"].pop(0)
            
            logger.debug(f"State changed: {self.previous_state} -> {self.current_state}")
            
        except Exception as e:
            logger.error(f"State change failed: {str(e)}", exc_info=True)
            raise StateError(f"State change failed: {str(e)}")
    
    def set_phone_state(self, state: str) -> None:
        """
        Set phone subsystem state
        
        Args:
            state: New phone state
        """
        self.phone_state = state
        logger.debug(f"Phone state set to: {state}")
    
    def set_last_command(self, command: Any) -> None:
        """
        Record last executed command
        
        Args:
            command: Command instance or dictionary
        """
        try:
            command_data = {
                "timestamp": datetime.now().isoformat(),
                "command": command.name if hasattr(command, "name") else str(command),
                "args": command.args if hasattr(command, "args") else {},
            }
            
            self.last_command = command_data
            
            # Add to command history
            self.debug_info["command_history"].append(command_data)
            if len(self.debug_info["command_history"]) > 100:
                self.debug_info["command_history"].pop(0)
            
            logger.debug(f"Recorded command: {command_data['command']}")
            
        except Exception as e:
            logger.error(f"Failed to record command: {str(e)}", exc_info=True)
    
    def update_timer_state(self, timer_id: str, timer_data: Dict[str, Any]) -> None:
        """
        Update state of active timer
        
        Args:
            timer_id: Timer identifier
            timer_data: Timer state data
        """
        self.active_timers[timer_id] = timer_data
        logger.debug(f"Updated timer state: {timer_id}")
    
    def remove_timer(self, timer_id: str) -> None:
        """
        Remove timer from active timers
        
        Args:
            timer_id: Timer identifier
        """
        if timer_id in self.active_timers:
            del self.active_timers[timer_id]
            logger.debug(f"Removed timer: {timer_id}")
    
    def set_service_state(self, service: str, connected: bool) -> None:
        """
        Update service connection state
        
        Args:
            service: Service identifier
            connected: Connection state
        """
        if service == "home_assistant":
            self.home_assistant_connected = connected
        elif service == "audio":
            self.audio_active = connected
        elif service == "voice":
            self.voice_recognition_active = connected
        
        logger.debug(f"Service {service} state set to: {'connected' if connected else 'disconnected'}")
    
    def log_error(self, error: str, context: Optional[Dict[str, Any]] = None) -> None:
        """
        Log error with context for debugging
        
        Args:
            error: Error message
            context: Optional error context
        """
        error_entry = {
            "timestamp": datetime.now().isoformat(),
            "error": error,
            "context": context or {},
            "state": self.current_state
        }
        
        self.debug_info["error_log"].append(error_entry)
        if len(self.debug_info["error_log"]) > 100:
            self.debug_info["error_log"].pop(0)
        
        logger.error(f"Error logged: {error}")
    
    def record_metric(self, metric_type: str, value: float) -> None:
        """
        Record performance metric
        
        Args:
            metric_type: Type of metric
            value: Metric value
        """
        if metric_type in self.debug_info["performance_metrics"]:
            metrics = self.debug_info["performance_metrics"][metric_type]
            metrics.append(value)
            
            # Keep only last 1000 measurements
            if len(metrics) > 1000:
                metrics.pop(0)
            
            logger.debug(f"Recorded metric {metric_type}: {value}")
    
    def get_state(self) -> Dict[str, Any]:
        """
        Get complete system state
        
        Returns:
            Dictionary containing current system state
        """
        return {
            "system": {
                "current_state": self.current_state,
                "previous_state": self.previous_state,
                "state_change_time": self.state_change_time.isoformat(),
                "uptime": (datetime.now() - self.state_change_time).total_seconds()
            },
            "phone": {
                "state": self.phone_state
            },
            "timers": self.active_timers,
            "last_command": self.last_command,
            "services": {
                "home_assistant": self.home_assistant_connected,
                "audio": self.audio_active,
                "voice": self.voice_recognition_active
            }
        }
    
    def get_debug_state(self) -> Dict[str, Any]:
        """
        Get complete system state with debug information
        
        Returns:
            Dictionary containing system state and debug info
        """
        return {
            **self.get_state(),
            "debug": self.debug_info
        }

# Example usage:
#
# state_manager = StateManager()
#
# # Update system state
# state_manager.set_state("processing")
#
# # Record command execution
# state_manager.set_last_command({
#     "name": "quick_timer",
#     "args": {"minutes": 5}
# })
#
# # Update timer state
# state_manager.update_timer_state("timer_1", {
#     "duration": 300,
#     "remaining": 295
# })
#
# # Log error
# state_manager.log_error(
#     "Command failed",
#     {"command": "set_temperature", "reason": "connection_lost"}
# )
#
# # Get current state
# current_state = state_manager.get_state()
#
# # Get debug state
# debug_state = state_manager.get_debug_state()
