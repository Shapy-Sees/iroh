# File: iroh/utils/logger.py
# Enhanced logging utility for the Iroh Home Management System
# Provides configurable logging levels and formats with file and console output

import logging
import logging.handlers
import os
from pathlib import Path
from typing import Optional, Dict

# Global logger cache to avoid creating multiple loggers for the same name
_loggers: Dict[str, logging.Logger] = {}

class IrohLogger(logging.Logger):
    """
    Custom logger class with additional functionality for the Iroh system
    """
    def __init__(self, name: str):
        super().__init__(name)
        self.debugging_enabled = False
    
    def debug_verbose(self, msg: str, *args, **kwargs):
        """Extended debug logging for when verbose debugging is enabled"""
        if self.debugging_enabled:
            self.debug(msg, *args, **kwargs)

def setup_logger(
    level: str = "INFO",
    log_file: Optional[str] = None,
    log_format: Optional[str] = None,
    enable_console: bool = True,
    max_bytes: int = 10_485_760,  # 10MB
    backup_count: int = 5
) -> None:
    """
    Configure the logging system with the specified parameters
    
    Args:
        level: Logging level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
        log_file: Path to log file (optional)
        log_format: Custom log format (optional)
        enable_console: Whether to enable console logging
        max_bytes: Maximum size of log file before rotation
        backup_count: Number of backup files to keep
    """
    # Register our custom logger class
    logging.setLoggerClass(IrohLogger)
    
    # Set default format if none provided
    if not log_format:
        log_format = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    
    formatter = logging.Formatter(log_format)
    root_logger = logging.getLogger()
    
    # Clear any existing handlers
    root_logger.handlers.clear()
    
    # Set the root logger level
    root_logger.setLevel(level)
    
    if enable_console:
        # Console handler
        console_handler = logging.StreamHandler()
        console_handler.setFormatter(formatter)
        root_logger.addHandler(console_handler)
    
    if log_file:
        # Create log directory if it doesn't exist
        log_path = Path(log_file)
        log_path.parent.mkdir(parents=True, exist_ok=True)
        
        # Rotating file handler
        file_handler = logging.handlers.RotatingFileHandler(
            log_file,
            maxBytes=max_bytes,
            backupCount=backup_count
        )
        file_handler.setFormatter(formatter)
        root_logger.addHandler(file_handler)

def get_logger(name: str) -> logging.Logger:
    """
    Get a logger instance with the specified name
    
    Args:
        name: Logger name (typically __name__ of the module)
    
    Returns:
        Logger instance
    """
    if name not in _loggers:
        logger = logging.getLogger(name)
        _loggers[name] = logger
        
        # Set initial debugging state
        if isinstance(logger, IrohLogger):
            logger.debugging_enabled = os.environ.get("IROH_DEBUG", "").lower() == "true"
    
    return _loggers[name]

def set_debug_mode(enabled: bool = True) -> None:
    """
    Enable or disable verbose debugging for all loggers
    
    Args:
        enabled: Whether to enable debug mode
    """
    for logger in _loggers.values():
        if isinstance(logger, IrohLogger):
            logger.debugging_enabled = enabled

# Example usage in other modules:
#
# from iroh.utils.logger import get_logger
# logger = get_logger(__name__)
#
# logger.debug("Debug message")
# logger.info("Info message")
# logger.warning("Warning message")
# logger.error("Error message")
# logger.critical("Critical message")
# logger.debug_verbose("Detailed debug info")  # Only logged if debugging enabled
