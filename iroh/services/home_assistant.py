# File: iroh/services/home_assistant.py
# Home Assistant integration service for the Iroh Home Management System
# Handles communication with Home Assistant for home automation control

import asyncio
from typing import Dict, Any, Optional
import httpx
from datetime import datetime

from ..utils.logger import get_logger
from ..utils.config import Config
from ..core.command_parser import Command

logger = get_logger(__name__)

class HomeAssistantError(Exception):
    """Custom exception for Home Assistant-related errors"""
    pass

class HomeAssistantService:
    """
    Manages integration with Home Assistant for home automation control
    """
    def __init__(self, config: Config):
        self.config = config
        
        # Get Home Assistant configuration
        ha_config = config.get("notifications.home_assistant", {})
        self.base_url = ha_config.get("url", "http://homeassistant.local:8123")
        self.token = ha_config.get("token")
        self.verify_ssl = ha_config.get("verify_ssl", True)
        
        # Connection state
        self._connected = False
        self._last_state_update = None
        
        # HTTP client
        self._http_client = httpx.AsyncClient(
            timeout=30.0,
            verify=self.verify_ssl
        )
        
        logger.debug("HomeAssistantService initialized")
    
    async def connect(self) -> None:
        """
        Establish connection to Home Assistant
        
        Raises:
            HomeAssistantError: If connection fails
        """
        try:
            if not self.token:
                raise HomeAssistantError("Home Assistant token not configured")
            
            # Test connection by getting API status
            response = await self._http_client.get(
                f"{self.base_url}/api/",
                headers=self._get_headers()
            )
            response.raise_for_status()
            
            self._connected = True
            logger.info("Connected to Home Assistant")
            
        except Exception as e:
            self._connected = False
            logger.error(f"Failed to connect to Home Assistant: {str(e)}", exc_info=True)
            raise HomeAssistantError(f"Connection failed: {str(e)}")
    
    async def disconnect(self) -> None:
        """Disconnect from Home Assistant"""
        self._connected = False
        await self._http_client.aclose()
        logger.info("Disconnected from Home Assistant")
    
    async def handle_command(self, command: Command) -> None:
        """
        Handle a service command
        
        Args:
            command: Command instance to handle
            
        Raises:
            HomeAssistantError: If command handling fails
        """
        try:
            if not self._connected:
                raise HomeAssistantError("Not connected to Home Assistant")
            
            # Extract command details
            action = command.args.get("action")
            entity = command.args.get("entity")
            
            if not action or not entity:
                raise HomeAssistantError("Invalid command: missing action or entity")
            
            # Handle different actions
            if action == "lights_on":
                await self._call_service(
                    "light", "turn_on",
                    {"entity_id": entity}
                )
                
            elif action == "lights_off":
                await self._call_service(
                    "light", "turn_off",
                    {"entity_id": entity}
                )
                
            elif action == "set_temperature":
                temperature = command.args.get("temperature")
                if not temperature:
                    raise HomeAssistantError("Missing temperature value")
                
                await self._call_service(
                    "climate", "set_temperature",
                    {
                        "entity_id": entity,
                        "temperature": temperature
                    }
                )
            
            else:
                raise HomeAssistantError(f"Unknown action: {action}")
            
            logger.info(f"Executed Home Assistant command: {action} on {entity}")
            
        except Exception as e:
            logger.error(f"Command handling failed: {str(e)}", exc_info=True)
            raise HomeAssistantError(f"Command handling failed: {str(e)}")
    
    async def get_state(self, entity_id: str) -> Dict[str, Any]:
        """
        Get current state of an entity
        
        Args:
            entity_id: Entity ID to get state for
            
        Returns:
            Entity state dictionary
            
        Raises:
            HomeAssistantError: If state retrieval fails
        """
        try:
            if not self._connected:
                raise HomeAssistantError("Not connected to Home Assistant")
            
            response = await self._http_client.get(
                f"{self.base_url}/api/states/{entity_id}",
                headers=self._get_headers()
            )
            response.raise_for_status()
            
            return response.json()
            
        except Exception as e:
            logger.error(f"Failed to get entity state: {str(e)}", exc_info=True)
            raise HomeAssistantError(f"State retrieval failed: {str(e)}")
    
    async def _call_service(
        self,
        domain: str,
        service: str,
        data: Dict[str, Any]
    ) -> None:
        """
        Call a Home Assistant service
        
        Args:
            domain: Service domain
            service: Service name
            data: Service call data
            
        Raises:
            HomeAssistantError: If service call fails
        """
        try:
            response = await self._http_client.post(
                f"{self.base_url}/api/services/{domain}/{service}",
                headers=self._get_headers(),
                json=data
            )
            response.raise_for_status()
            
        except Exception as e:
            logger.error(f"Service call failed: {str(e)}", exc_info=True)
            raise HomeAssistantError(f"Service call failed: {str(e)}")
    
    def _get_headers(self) -> Dict[str, str]:
        """
        Get HTTP headers for Home Assistant API requests
        
        Returns:
            Headers dictionary
        """
        return {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }
    
    async def update_states(self) -> None:
        """
        Update cached states for all tracked entities
        
        Raises:
            HomeAssistantError: If state update fails
        """
        try:
            if not self._connected:
                raise HomeAssistantError("Not connected to Home Assistant")
            
            response = await self._http_client.get(
                f"{self.base_url}/api/states",
                headers=self._get_headers()
            )
            response.raise_for_status()
            
            self._last_state_update = datetime.now()
            
            logger.debug("Updated Home Assistant states")
            
        except Exception as e:
            logger.error(f"State update failed: {str(e)}", exc_info=True)
            raise HomeAssistantError(f"State update failed: {str(e)}")

# Example usage:
#
# ha = HomeAssistantService(config)
# await ha.connect()
#
# # Execute command
# command = Command(
#     name="service",
#     args={
#         "action": "lights_on",
#         "entity": "group.all_lights"
#     },
#     raw_sequence=[]
# )
# await ha.handle_command(command)
#
# # Get entity state
# state = await ha.get_state("climate.thermostat")
# print(f"Current temperature: {state['attributes']['current_temperature']}")
#
# # Cleanup
# await ha.disconnect()
