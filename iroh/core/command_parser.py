# File: iroh/core/command_parser.py
# Command parser for the Iroh Home Management System
# Interprets DTMF sequences and other inputs into system commands

import re
from dataclasses import dataclass
from typing import List, Dict, Any, Optional, Union

from ..utils.logger import get_logger
from ..utils.config import Config

logger = get_logger(__name__)

@dataclass
class Command:
    """
    Represents a parsed command with its name and arguments
    """
    name: str
    args: Dict[str, Any]
    raw_sequence: List[Dict[str, Any]]  # Original event sequence that generated this command

class CommandError(Exception):
    """Custom exception for command parsing errors"""
    pass

class CommandParser:
    """
    Parses event sequences into system commands using pattern matching and state tracking
    """
    def __init__(self):
        self.command_buffer: List[Dict[str, Any]] = []
        self._last_sequence_time = None
        
        # Command pattern matchers
        self.matchers = {
            "quick_timer": self._match_quick_timer,
            "service": self._match_service_command,
            "voice": self._match_voice_command
        }
        
        logger.debug("CommandParser initialized")
    
    async def parse_sequence(self, events: List[Dict[str, Any]]) -> Optional[Command]:
        """
        Parse a sequence of events into a command
        
        Args:
            events: List of event dictionaries to parse
            
        Returns:
            Parsed Command instance or None if no command matched
            
        Raises:
            CommandError: If parsing fails
        """
        try:
            # Try each command matcher
            for command_type, matcher in self.matchers.items():
                if command := matcher(events):
                    logger.debug(f"Matched command type: {command_type}")
                    return command
            
            return None
            
        except Exception as e:
            logger.error(f"Command parsing failed: {str(e)}", exc_info=True)
            raise CommandError(f"Command parsing failed: {str(e)}")
    
    def _match_quick_timer(self, events: List[Dict[str, Any]]) -> Optional[Command]:
        """
        Match quick timer command pattern:
        1. Phone off hook
        2. Single digit (1-9)
        3. Phone on hook
        
        Args:
            events: Event sequence to match
            
        Returns:
            Command instance if pattern matches, None otherwise
        """
        try:
            # Need exactly 3 events
            if len(events) != 3:
                return None
            
            # Check event sequence
            if not (
                events[0].get("type") == "off_hook" and
                events[1].get("type") == "dtmf" and
                events[2].get("type") == "on_hook"
            ):
                return None
            
            # Get DTMF digit
            digit = events[1].get("digit")
            if not digit or not digit.isdigit() or int(digit) < 1 or int(digit) > 9:
                return None
            
            # Create quick timer command
            return Command(
                name="quick_timer",
                args={"minutes": int(digit)},
                raw_sequence=events
            )
            
        except Exception as e:
            logger.error(f"Error matching quick timer: {str(e)}", exc_info=True)
            return None
    
    def _match_service_command(self, events: List[Dict[str, Any]]) -> Optional[Command]:
        """
        Match service command pattern:
        1. '*' prefix
        2. Command sequence
        
        Patterns:
        - *1: lights on
        - *0: lights off
        - *2XX: set temperature XX
        
        Args:
            events: Event sequence to match
            
        Returns:
            Command instance if pattern matches, None otherwise
        """
        try:
            # Need at least 2 DTMF events
            if len(events) < 2:
                return None
            
            # All events must be DTMF
            if not all(e.get("type") == "dtmf" for e in events):
                return None
            
            # First digit must be *
            if events[0].get("digit") != "*":
                return None
            
            # Get command sequence
            sequence = "".join(e.get("digit", "") for e in events[1:])
            
            # Match patterns
            if sequence == "1":
                return Command(
                    name="service",
                    args={
                        "action": "lights_on",
                        "entity": "group.all_lights"
                    },
                    raw_sequence=events
                )
                
            elif sequence == "0":
                return Command(
                    name="service",
                    args={
                        "action": "lights_off",
                        "entity": "group.all_lights"
                    },
                    raw_sequence=events
                )
                
            elif re.match(r"2\d{2}$", sequence):
                temp = int(sequence[1:])
                if 60 <= temp <= 85:  # Valid temperature range
                    return Command(
                        name="service",
                        args={
                            "action": "set_temperature",
                            "entity": "climate.thermostat",
                            "temperature": temp
                        },
                        raw_sequence=events
                    )
            
            return None
            
        except Exception as e:
            logger.error(f"Error matching service command: {str(e)}", exc_info=True)
            return None
    
    def _match_voice_command(self, events: List[Dict[str, Any]]) -> Optional[Command]:
        """
        Match voice command pattern:
        1. '#' prefix to activate voice mode
        
        Args:
            events: Event sequence to match
            
        Returns:
            Command instance if pattern matches, None otherwise
        """
        try:
            # Need exactly 1 DTMF event
            if len(events) != 1:
                return None
            
            # Must be DTMF #
            if not (
                events[0].get("type") == "dtmf" and
                events[0].get("digit") == "#"
            ):
                return None
            
            # Create voice command
            return Command(
                name="voice",
                args={},
                raw_sequence=events
            )
            
        except Exception as e:
            logger.error(f"Error matching voice command: {str(e)}", exc_info=True)
            return None
    
    def _validate_sequence(self, events: List[Dict[str, Any]]) -> bool:
        """
        Validate event sequence structure
        
        Args:
            events: Event sequence to validate
            
        Returns:
            True if sequence is valid, False otherwise
        """
        try:
            if not events:
                return False
            
            for event in events:
                if not isinstance(event, dict):
                    return False
                if "type" not in event:
                    return False
                if event["type"] not in ["dtmf", "off_hook", "on_hook", "voice"]:
                    return False
                
            return True
            
        except Exception:
            return False

# Example usage:
#
# parser = CommandParser()
#
# # Parse quick timer sequence
# events = [
#     {"type": "off_hook"},
#     {"type": "dtmf", "digit": "5"},
#     {"type": "on_hook"}
# ]
# command = await parser.parse_sequence(events)
# if command and command.name == "quick_timer":
#     print(f"Setting {command.args['minutes']} minute timer")
#
# # Parse service command sequence
# events = [
#     {"type": "dtmf", "digit": "*"},
#     {"type": "dtmf", "digit": "1"}
# ]
# command = await parser.parse_sequence(events)
# if command and command.name == "service":
#     print(f"Service command: {command.args['action']}")
