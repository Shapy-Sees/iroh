# File: iroh/core/timer_manager.py
# Timer management system for the Iroh Home Management System
# Handles timer creation, tracking, and notifications

import asyncio
import uuid
from datetime import datetime, timedelta
from typing import Dict, Optional, Any

from ..utils.logger import get_logger
from ..services.audio_service import AudioService

logger = get_logger(__name__)

class TimerError(Exception):
    """Custom exception for timer-related errors"""
    pass

class Timer:
    """
    Represents a single timer instance with its properties and state
    """
    def __init__(self, duration: int, name: Optional[str] = None):
        self.id = str(uuid.uuid4())
        self.name = name or f"Timer_{self.id[:8]}"
        self.duration = duration  # seconds
        self.start_time = datetime.now()
        self.end_time = self.start_time + timedelta(seconds=duration)
        self.remaining = duration
        self.completed = False
        self.cancelled = False
        self.task: Optional[asyncio.Task] = None
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert timer to dictionary representation"""
        return {
            "id": self.id,
            "name": self.name,
            "duration": self.duration,
            "start_time": self.start_time.isoformat(),
            "end_time": self.end_time.isoformat(),
            "remaining": self.remaining,
            "completed": self.completed,
            "cancelled": self.cancelled
        }

class TimerManager:
    """
    Manages system timers with audio feedback and notifications
    """
    def __init__(self, audio_service: AudioService):
        self.audio = audio_service
        self.active_timers: Dict[str, Timer] = {}
        self._cleanup_task: Optional[asyncio.Task] = None
        
        # Start periodic cleanup of completed timers
        self._start_cleanup()
        
        logger.debug("TimerManager initialized")
    
    async def quick_timer(self, minutes: int) -> Timer:
        """
        Create a quick timer with audio confirmation
        
        Args:
            minutes: Duration in minutes
            
        Returns:
            Created Timer instance
            
        Raises:
            TimerError: If timer creation fails
        """
        try:
            # Validate input
            if not 1 <= minutes <= 60:
                raise TimerError("Quick timer duration must be between 1 and 60 minutes")
            
            # Create timer
            duration = minutes * 60  # convert to seconds
            timer = Timer(duration, f"QuickTimer_{minutes}min")
            
            # Start timer task
            timer.task = asyncio.create_task(
                self._run_timer(timer)
            )
            
            # Store timer
            self.active_timers[timer.id] = timer
            
            # Provide audio confirmation
            await self.audio.speak(f"Setting {minutes} minute timer")
            
            logger.info(f"Created quick timer for {minutes} minutes (ID: {timer.id})")
            return timer
            
        except Exception as e:
            logger.error(f"Failed to create quick timer: {str(e)}", exc_info=True)
            raise TimerError(f"Failed to create quick timer: {str(e)}")
    
    async def create_timer(self, duration: int, name: Optional[str] = None) -> Timer:
        """
        Create a new timer
        
        Args:
            duration: Timer duration in seconds
            name: Optional timer name
            
        Returns:
            Created Timer instance
            
        Raises:
            TimerError: If timer creation fails
        """
        try:
            # Create timer
            timer = Timer(duration, name)
            
            # Start timer task
            timer.task = asyncio.create_task(
                self._run_timer(timer)
            )
            
            # Store timer
            self.active_timers[timer.id] = timer
            
            logger.info(f"Created timer '{timer.name}' for {duration}s (ID: {timer.id})")
            return timer
            
        except Exception as e:
            logger.error(f"Failed to create timer: {str(e)}", exc_info=True)
            raise TimerError(f"Failed to create timer: {str(e)}")
    
    async def cancel_timer(self, timer_id: str) -> None:
        """
        Cancel an active timer
        
        Args:
            timer_id: ID of timer to cancel
            
        Raises:
            TimerError: If timer not found or cancellation fails
        """
        try:
            if timer_id not in self.active_timers:
                raise TimerError(f"Timer not found: {timer_id}")
            
            timer = self.active_timers[timer_id]
            
            # Cancel timer task
            if timer.task and not timer.task.done():
                timer.task.cancel()
                timer.cancelled = True
                
                # Provide audio confirmation
                await self.audio.speak(f"Timer {timer.name} cancelled")
            
            logger.info(f"Cancelled timer {timer_id}")
            
        except Exception as e:
            logger.error(f"Failed to cancel timer: {str(e)}", exc_info=True)
            raise TimerError(f"Failed to cancel timer: {str(e)}")
    
    def get_timer(self, timer_id: str) -> Optional[Timer]:
        """
        Get timer by ID
        
        Args:
            timer_id: Timer ID
            
        Returns:
            Timer instance or None if not found
        """
        return self.active_timers.get(timer_id)
    
    def get_active_timers(self) -> Dict[str, Timer]:
        """
        Get all active timers
        
        Returns:
            Dictionary of active timer instances
        """
        return {
            timer_id: timer 
            for timer_id, timer in self.active_timers.items()
            if not timer.completed and not timer.cancelled
        }
    
    async def _run_timer(self, timer: Timer) -> None:
        """
        Run timer task
        
        Args:
            timer: Timer instance to run
        """
        try:
            while timer.remaining > 0 and not timer.cancelled:
                await asyncio.sleep(1)
                timer.remaining -= 1
                
                # Handle one minute remaining
                if timer.remaining == 60:
                    await self.audio.speak("One minute remaining")
            
            if not timer.cancelled:
                timer.completed = True
                
                # Play timer completion sound and notification
                await self.audio.speak(f"Timer {timer.name} complete")
                
                logger.info(f"Timer {timer.id} completed")
            
        except asyncio.CancelledError:
            logger.debug(f"Timer {timer.id} cancelled")
            raise
        except Exception as e:
            logger.error(f"Error in timer task: {str(e)}", exc_info=True)
            raise
    
    def _start_cleanup(self) -> None:
        """Start periodic cleanup of completed timers"""
        if not self._cleanup_task:
            self._cleanup_task = asyncio.create_task(self._cleanup_loop())
    
    async def _cleanup_loop(self) -> None:
        """Periodically clean up completed and cancelled timers"""
        while True:
            try:
                # Remove completed and cancelled timers after 1 hour
                cutoff = datetime.now() - timedelta(hours=1)
                
                to_remove = [
                    timer_id
                    for timer_id, timer in self.active_timers.items()
                    if (timer.completed or timer.cancelled) and timer.end_time < cutoff
                ]
                
                for timer_id in to_remove:
                    del self.active_timers[timer_id]
                
                if to_remove:
                    logger.debug(f"Cleaned up {len(to_remove)} old timers")
                
                await asyncio.sleep(300)  # Run cleanup every 5 minutes
                
            except Exception as e:
                logger.error(f"Error in timer cleanup: {str(e)}", exc_info=True)
                await asyncio.sleep(60)  # Retry after 1 minute on error

# Example usage:
#
# audio_service = AudioService(config)
# timer_manager = TimerManager(audio_service)
#
# # Create a quick 5-minute timer
# timer = await timer_manager.quick_timer(5)
#
# # Create a custom timer
# timer = await timer_manager.create_timer(
#     duration=300,  # 5 minutes
#     name="Tea Timer"
# )
#
# # Cancel a timer
# await timer_manager.cancel_timer(timer.id)
#
# # Get active timers
# active_timers = timer_manager.get_active_timers()
