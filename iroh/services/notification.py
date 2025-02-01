# File: iroh/services/notification.py
# Notification service for the Iroh Home Management System
# Handles dispatching notifications through various channels

import asyncio
from datetime import datetime
from typing import List, Dict, Any, Optional
import httpx

from ..utils.logger import get_logger
from ..utils.config import Config

logger = get_logger(__name__)

class NotificationError(Exception):
    """Custom exception for notification-related errors"""
    pass

class NotificationService:
    """
    Manages system notifications through multiple channels including
    audio feedback, Home Assistant, and console output
    """
    def __init__(self, config: Config):
        self.config = config
        self.rest_url = config.get("phone.api.rest_url", "http://localhost:8000")
        
        # Get notification methods from config
        self.notification_methods = config.get(
            "notifications.notification_methods",
            ["audio", "home_assistant", "console"]
        )
        
        # HTTP client for REST API
        self._http_client = httpx.AsyncClient(timeout=30.0)
        
        logger.debug(f"NotificationService initialized with methods: {self.notification_methods}")
    
    async def notify(
        self,
        message: str,
        title: Optional[str] = None,
        level: str = "info",
        methods: Optional[List[str]] = None,
        data: Optional[Dict[str, Any]] = None
    ) -> None:
        """
        Send notification through configured channels
        
        Args:
            message: Notification message
            title: Optional notification title
            level: Notification level (info, warning, error)
            methods: Optional list of specific methods to use
            data: Optional additional data for the notification
            
        Raises:
            NotificationError: If notification fails
        """
        try:
            # Use specified methods or default to all configured methods
            notification_methods = methods or self.notification_methods
            
            # Create notification data
            notification = {
                "title": title or "Iroh Notification",
                "message": message,
                "level": level,
                "timestamp": datetime.now().isoformat(),
                "data": data or {}
            }
            
            # Send through each method
            tasks = []
            for method in notification_methods:
                if method == "audio":
                    tasks.append(self._notify_audio(notification))
                elif method == "home_assistant":
                    tasks.append(self._notify_home_assistant(notification))
                elif method == "console":
                    tasks.append(self._notify_console(notification))
            
            # Wait for all notifications to complete
            await asyncio.gather(*tasks)
            
            logger.debug(
                f"Notification sent through methods: {notification_methods}"
            )
            
        except Exception as e:
            logger.error(f"Notification failed: {str(e)}", exc_info=True)
            raise NotificationError(f"Notification failed: {str(e)}")
    
    async def _notify_audio(self, notification: Dict[str, Any]) -> None:
        """
        Send notification through audio channel
        
        Args:
            notification: Notification data dictionary
        """
        try:
            # Use appropriate ring pattern based on notification level
            pattern = {
                "info": "SINGLE",
                "warning": "DISTINCTIVE1",
                "error": "URGENT"
            }.get(notification["level"], "SINGLE")
            
            # Ring phone with appropriate pattern
            response = await self._http_client.post(
                f"{self.rest_url}/ring",
                json={
                    "pattern": pattern,
                    "repeat": 1
                }
            )
            response.raise_for_status()
            
            # Generate speech for notification
            response = await self._http_client.post(
                f"{self.rest_url}/generate-tts",
                json={
                    "text": notification["message"],
                    "voice": self.config.get("audio.voice", "en-US-Standard-D"),
                    "volume": self.config.get("audio.volume", 0.8)
                }
            )
            response.raise_for_status()
            
            # Play the audio
            audio_data = response.content
            response = await self._http_client.post(
                f"{self.rest_url}/play-audio",
                content=audio_data,
                headers={"Content-Type": "application/octet-stream"}
            )
            response.raise_for_status()
            
        except Exception as e:
            logger.error(f"Audio notification failed: {str(e)}", exc_info=True)
            raise NotificationError(f"Audio notification failed: {str(e)}")
    
    async def _notify_home_assistant(self, notification: Dict[str, Any]) -> None:
        """
        Send notification through Home Assistant
        
        Args:
            notification: Notification data dictionary
        """
        try:
            ha_config = self.config.get("notifications.home_assistant", {})
            if not ha_config.get("url") or not ha_config.get("token"):
                logger.warning("Home Assistant not configured for notifications")
                return
            
            # Send notification to Home Assistant
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{ha_config['url']}/api/services/notify/notify",
                    headers={
                        "Authorization": f"Bearer {ha_config['token']}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "title": notification["title"],
                        "message": notification["message"],
                        "data": {
                            "level": notification["level"],
                            **notification["data"]
                        }
                    },
                    verify=ha_config.get("verify_ssl", True)
                )
                response.raise_for_status()
            
        except Exception as e:
            logger.error(f"Home Assistant notification failed: {str(e)}", exc_info=True)
            raise NotificationError(f"Home Assistant notification failed: {str(e)}")
    
    async def _notify_console(self, notification: Dict[str, Any]) -> None:
        """
        Send notification to console log
        
        Args:
            notification: Notification data dictionary
        """
        try:
            # Log based on notification level
            log_message = f"{notification['title']}: {notification['message']}"
            
            if notification["level"] == "error":
                logger.error(log_message)
            elif notification["level"] == "warning":
                logger.warning(log_message)
            else:
                logger.info(log_message)
            
        except Exception as e:
            logger.error(f"Console notification failed: {str(e)}", exc_info=True)
            raise NotificationError(f"Console notification failed: {str(e)}")
    
    async def close(self) -> None:
        """Clean up resources"""
        await self._http_client.aclose()
        logger.debug("NotificationService closed")

# Example usage:
#
# notifier = NotificationService(config)
#
# # Simple notification
# await notifier.notify("Timer complete")
#
# # Warning with specific methods
# await notifier.notify(
#     message="Temperature too high",
#     title="Climate Warning",
#     level="warning",
#     methods=["home_assistant", "console"]
# )
#
# # Error with additional data
# await notifier.notify(
#     message="Connection lost",
#     title="System Error",
#     level="error",
#     data={"component": "home_assistant", "retry_count": 3}
# )
#
# # Cleanup
# await notifier.close()
