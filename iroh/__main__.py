# File: iroh/__main__.py
# Main entry point for the Iroh Home Management System
# This file initializes all components and starts the system

import asyncio
import sys
from pathlib import Path

from iroh.core import IrohOperator
from iroh.utils import setup_logger, Config, DebugUtils
from iroh.utils.logger import get_logger

# Initialize logging first
logger = get_logger(__name__)

async def main():
    """
    Main entry point for the Iroh system
    Initializes all components and starts the main event loop
    """
    try:
        # Load configuration
        config_path = Path(__file__).parent / "config" / "config.yml"
        commands_path = Path(__file__).parent / "config" / "commands.yml"
        
        logger.info("Starting Iroh Home Management System...")
        logger.debug(f"Loading configuration from {config_path}")
        
        # Initialize configuration
        config = Config()
        await config.load(config_path, commands_path)
        
        # Setup logging based on configuration
        log_level = config.get("system.log_level", "INFO")
        setup_logger(level=log_level)
        
        # Initialize debug utilities if debug mode is enabled
        if config.get("system.debug_mode", False):
            logger.info("Debug mode enabled")
            debug_utils = DebugUtils()
            debug_utils.start_monitoring()
        
        # Create and start the main operator
        operator = IrohOperator()
        logger.info("Initializing system operator...")
        
        try:
            await operator.start()
            logger.info("System startup complete")
            
            # Keep the system running
            while True:
                await asyncio.sleep(1)
                
        except KeyboardInterrupt:
            logger.info("Shutdown signal received")
            await operator.shutdown()
            
    except Exception as e:
        logger.error(f"Fatal error during startup: {str(e)}", exc_info=True)
        sys.exit(1)

if __name__ == "__main__":
    try:
        # Run the async main function
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("System shutdown complete")
    except Exception as e:
        logger.critical(f"Unhandled exception: {str(e)}", exc_info=True)
        sys.exit(1)
