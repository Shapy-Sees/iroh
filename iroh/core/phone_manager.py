# File: iroh/core/phone_manager.py
# DAHDI phone interface manager for the Iroh Home Management System
# Handles phone line control and DTMF event processing through the DAHDI API

import asyncio
import json
import websockets
import httpx
from datetime import datetime
from typing import AsyncGenerator, Dict, Any, Optional

from ..utils.logger import get_logger
from ..utils.config import Config

logger = get_logger(__name__)

class PhoneError(Exception):
    """Custom exception for phone-related errors"""
    pass

class PhoneManager:
    """
    Manages phone interface through DAHDI API, handling both REST and WebSocket connections
    for control operations and event monitoring
    """
    def __init__(self, config: Config):
        # Configuration
        self.config = config
        self.rest_url = config.get("phone.api.rest_url", "http://localhost:8000")
        self.ws_url = config.get("phone.api.ws_url", "ws://localhost:8001/ws")
        self.ring_timeout = config.get("phone.ring_timeout", 30)
        self.dtmf_timeout = config.get("phone.dtmf_timeout", 5)
        
        # State tracking
        self._running = False
        self._ws_client: Optional[websockets.WebSocketClientProtocol] = None
        self._event_queue: asyncio.Queue = asyncio.Queue()
        self._command_buffer = []
        self._last_dtmf_time: Optional[datetime] = None
        
        # HTTP client for REST API
        self._http_client = httpx.AsyncClient(timeout=30.0)
        
        logger.debug("PhoneManager initialized")
    
    async def connect(self) -> None:
        """
        Connect to DAHDI API services and start event monitoring
        
        Raises:
            PhoneError: If connection fails
        """
        try:
            # First verify REST API is available
            logger.debug("Verifying REST API connection...")
            response = await self._http_client.get(f"{self.rest_url}/status")
            response.raise_for_status()
            
            # Start WebSocket connection
            logger.debug("Establishing WebSocket connection...")
            self._running = True
            asyncio.create_task(self._maintain_ws_connection())
            
            logger.info("Successfully connected to DAHDI API services")
            
        except httpx.HTTPError as e:
            logger.error(f"Failed to connect to REST API: {str(e)}", exc_info=True)
            raise PhoneError(f"REST API connection failed: {str(e)}")
        except Exception as e:
            logger.error(f"Connection failed: {str(e)}", exc_info=True)
            raise PhoneError(f"Connection failed: {str(e)}")
    
    async def disconnect(self) -> None:
        """Disconnect from DAHDI API services"""
        logger.info("Disconnecting from DAHDI API services")
        
        self._running = False
        
        # Close WebSocket connection
        if self._ws_client:
            await self._ws_client.close()
        
        # Close HTTP client
        await self._http_client.aclose()
    
    async def events(self) -> AsyncGenerator[Dict[str, Any], None]:
        """
        Generate phone events (DTMF, hook state changes, etc.)
        
        Yields:
            Event dictionaries containing event type and data
        """
        while self._running:
            try:
                event = await self._event_queue.get()
                yield event
                self._event_queue.task_done()
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in event generator: {str(e)}", exc_info=True)
                await asyncio.sleep(1)
    
    async def _maintain_ws_connection(self) -> None:
        """Maintain WebSocket connection with automatic reconnection"""
        while self._running:
            try:
                async with websockets.connect(self.ws_url) as ws:
                    self._ws_client = ws
                    logger.info("WebSocket connection established")
                    await self._handle_ws_events(ws)
                    
            except websockets.ConnectionClosed:
                logger.warning("WebSocket connection closed, reconnecting...")
                await asyncio.sleep(5)
            except Exception as e:
                logger.error(f"WebSocket error: {str(e)}", exc_info=True)
                await asyncio.sleep(5)
    
    async def _handle_ws_events(self, ws: websockets.WebSocketClientProtocol) -> None:
        """
        Handle incoming WebSocket events
        
        Args:
            ws: WebSocket client connection
        """
        while self._running:
            try:
                message = await ws.recv()
                event_data = json.loads(message)
                
                # Process and validate event
                if processed_event := self._process_event(event_data):
                    await self._event_queue.put(processed_event)
                
            except websockets.ConnectionClosed:
                break
            except json.JSONDecodeError as e:
                logger.error(f"Invalid JSON in WebSocket message: {str(e)}")
            except Exception as e:
                logger.error(f"Error processing WebSocket message: {str(e)}", exc_info=True)
    
    def _process_event(self, event_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Process and validate incoming events
        
        Args:
            event_data: Raw event data from WebSocket
            
        Returns:
            Processed event dictionary or None if invalid
        """
        try:
            # Validate event has required fields
            if "type" not in event_data:
                raise ValueError("Event missing type field")
            
            # Process different event types
            if event_data["type"] == "dtmf":
                if "digit" not in event_data:
                    raise ValueError("DTMF event missing digit")
                self._handle_dtmf_buffer(event_data)
            
            return event_data
            
        except Exception as e:
            logger.error(f"Event processing error: {str(e)}", exc_info=True)
            return None
    
    def _handle_dtmf_buffer(self, event_data: Dict[str, Any]) -> None:
        """
        Handle DTMF digit buffering and timeouts
        
        Args:
            event_data: DTMF event data
        """
        now = datetime.fromisoformat(event_data["timestamp"])
        
        # Clear buffer if timeout exceeded
        if self._last_dtmf_time and (now - self._last_dtmf_time).seconds > self.dtmf_timeout:
            self._command_buffer.clear()
        
        # Update buffer and timestamp
        self._command_buffer.append(event_data["digit"])
        self._last_dtmf_time = now
        
        # Add buffer to event data
        event_data["buffer"] = self._command_buffer.copy()
    
    async def ring(self, pattern: str = "NORMAL", repeat: int = 1) -> None:
        """
        Start phone ringing with specified pattern
        
        Args:
            pattern: Ring pattern name
            repeat: Number of pattern repetitions
            
        Raises:
            PhoneError: If ring command fails
        """
        try:
            response = await self._http_client.post(
                f"{self.rest_url}/ring",
                json={
                    "pattern": pattern,
                    "repeat": repeat
                }
            )
            response.raise_for_status()
            
        except Exception as e:
            logger.error(f"Ring command failed: {str(e)}", exc_info=True)
            raise PhoneError(f"Ring command failed: {str(e)}")
    
    async def stop_ring(self) -> None:
        """
        Stop phone ringing
        
        Raises:
            PhoneError: If stop ring command fails
        """
        try:
            response = await self._http_client.post(f"{self.rest_url}/stop-ring")
            response.raise_for_status()
            
        except Exception as e:
            logger.error(f"Stop ring command failed: {str(e)}", exc_info=True)
            raise PhoneError(f"Stop ring command failed: {str(e)}")
    
    async def play_audio(self, audio_data: bytes) -> None:
        """
        Play audio through phone line
        
        Args:
            audio_data: Raw audio bytes (8kHz, 16-bit, mono)
            
        Raises:
            PhoneError: If audio playback fails
        """
        try:
            response = await self._http_client.post(
                f"{self.rest_url}/play-audio",
                content=audio_data,
                headers={"Content-Type": "application/octet-stream"}
            )
            response.raise_for_status()
            
        except Exception as e:
            logger.error(f"Audio playback failed: {str(e)}", exc_info=True)
            raise PhoneError(f"Audio playback failed: {str(e)}")

# Example usage:
#
# phone = PhoneManager(config)
# await phone.connect()
# 
# # Start event processing
# async for event in phone.events():
#     if event["type"] == "dtmf":
#         print(f"DTMF digit: {event['digit']}")
#     elif event["type"] == "off_hook":
#         print("Phone off hook")
# 
# # Ring phone
# await phone.ring(pattern="TIMER", repeat=1)
# 
# # Cleanup
# await phone.disconnect()
