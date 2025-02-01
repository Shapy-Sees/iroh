# File: iroh/utils/config.py
# Configuration management utility for the Iroh Home Management System
# Handles loading, validating, and accessing configuration settings

import os
from pathlib import Path
from typing import Any, Dict, Optional, Union
import yaml

from .logger import get_logger

logger = get_logger(__name__)

class ConfigError(Exception):
    """Custom exception for configuration-related errors"""
    pass

class Config:
    """
    Configuration management class that handles loading and accessing
    configuration settings from YAML files
    """
    def __init__(self):
        self._config: Dict[str, Any] = {}
        self._commands: Dict[str, Any] = {}
        self._initialized = False
    
    async def load(self, config_path: Union[str, Path], commands_path: Union[str, Path]) -> None:
        """
        Load configuration from YAML files
        
        Args:
            config_path: Path to main configuration file
            commands_path: Path to commands configuration file
            
        Raises:
            ConfigError: If configuration loading or validation fails
        """
        try:
            # Load main configuration
            with open(config_path, 'r') as f:
                self._config = yaml.safe_load(f)
            logger.debug(f"Loaded main configuration from {config_path}")
            
            # Load commands configuration
            with open(commands_path, 'r') as f:
                self._commands = yaml.safe_load(f)
            logger.debug(f"Loaded commands configuration from {commands_path}")
            
            # Validate configurations
            self._validate_config()
            self._validate_commands()
            
            # Apply environment variable overrides
            self._apply_env_overrides()
            
            self._initialized = True
            logger.info("Configuration loaded and validated successfully")
            
        except yaml.YAMLError as e:
            raise ConfigError(f"Error parsing YAML configuration: {str(e)}")
        except FileNotFoundError as e:
            raise ConfigError(f"Configuration file not found: {str(e)}")
        except Exception as e:
            raise ConfigError(f"Error loading configuration: {str(e)}")
    
    def get(self, path: str, default: Any = None) -> Any:
        """
        Get a configuration value using dot notation path
        
        Args:
            path: Configuration path (e.g., 'system.log_level')
            default: Default value if path not found
            
        Returns:
            Configuration value or default if not found
        """
        if not self._initialized:
            raise ConfigError("Configuration not initialized. Call load() first.")
        
        try:
            value = self._config
            for key in path.split('.'):
                value = value[key]
            return value
        except (KeyError, TypeError):
            return default
    
    def get_command(self, command_name: str) -> Optional[Dict[str, Any]]:
        """
        Get command configuration by name
        
        Args:
            command_name: Name of the command
            
        Returns:
            Command configuration dictionary or None if not found
        """
        if not self._initialized:
            raise ConfigError("Configuration not initialized. Call load() first.")
        
        return self._commands.get('commands', {}).get(command_name)
    
    def _validate_config(self) -> None:
        """
        Validate main configuration structure and required fields
        
        Raises:
            ConfigError: If validation fails
        """
        required_sections = ['system', 'audio', 'notifications', 'phone', 'timers']
        
        for section in required_sections:
            if section not in self._config:
                raise ConfigError(f"Missing required configuration section: {section}")
        
        # Validate system section
        system = self._config['system']
        if not isinstance(system.get('name', ''), str):
            raise ConfigError("System name must be a string")
        if not isinstance(system.get('log_level', ''), str):
            raise ConfigError("Log level must be a string")
    
    def _validate_commands(self) -> None:
        """
        Validate commands configuration structure
        
        Raises:
            ConfigError: If validation fails
        """
        if 'commands' not in self._commands:
            raise ConfigError("Missing 'commands' section in commands configuration")
        
        for name, cmd in self._commands['commands'].items():
            if 'trigger' not in cmd:
                raise ConfigError(f"Command '{name}' missing required 'trigger' field")
            if not isinstance(cmd.get('enabled', True), bool):
                raise ConfigError(f"Command '{name}' 'enabled' field must be a boolean")
    
    def _apply_env_overrides(self) -> None:
        """Apply any environment variable overrides to the configuration"""
        # Override system name if environment variable exists
        if system_name := os.environ.get('IROH_SYSTEM_NAME'):
            self._config['system']['name'] = system_name
            logger.debug(f"Overrode system name from environment: {system_name}")
        
        # Override log level if environment variable exists
        if log_level := os.environ.get('IROH_LOG_LEVEL'):
            self._config['system']['log_level'] = log_level
            logger.debug(f"Overrode log level from environment: {log_level}")
        
        # Override debug mode if environment variable exists
        if debug_mode := os.environ.get('IROH_DEBUG_MODE'):
            self._config['system']['debug_mode'] = debug_mode.lower() == 'true'
            logger.debug(f"Overrode debug mode from environment: {debug_mode}")

# Example usage:
#
# config = Config()
# await config.load('config.yml', 'commands.yml')
# log_level = config.get('system.log_level', 'INFO')
# timer_command = config.get_command('quick_timer')
