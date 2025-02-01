# File: iroh/services/audio_service.py
# Audio service for the Iroh Home Management System
# Handles audio playback and text-to-speech functionality

import asyncio
from typing import Optional, Dict, Any
import httpx

from ..utils.logger import get_logger
from ..utils.config import Config

logger = get_logger(__name__)

class AudioError(Exception):
    """Custom exception for audio-related errors"""
    pass

class AudioService:
    """
    Manages audio playback and text-to-speech through the DAHDI API
    """
    def __init__(self, config: Config):
        self.config = config
        self.rest_url = config.get("phone.api.rest_url", "http://localhost:8000")
        self.tts_enabled = config.get("audio.enable_tts", True)
        self.volume = config.get("audio.volume", 0.8)
        
        # Audio format settings
        self.sample_rate = config.get("audio.sample_rate", 8000)
        self.channels = config.get("audio.channels", 1)
        self.bit_depth = config.get("audio.bit_depth", 16)
        
        # HTTP client for REST API
        self._http_client = httpx.AsyncClient(timeout=30.0)
        
        logger.debug("AudioService initialized")
    
    async def speak(self, text: str) -> None:
        """
        Convert text to speech and play through phone line
        
        Args:
            text: Text to speak
            
        Raises:
            AudioError: If TTS or playback fails
        """
        try:
            if not self.tts_enabled:
                logger.warning("TTS is disabled")
                return
            
            logger.debug(f"Converting text to speech: {text}")
            
            # First generate TTS audio using phone API
            response = await self._http_client.post(
                f"{self.rest_url}/generate-tts",
                json={
                    "text": text,
                    "voice": self.config.get("audio.voice", "en-US-Standard-D"),
                    "volume": self.volume
                }
            )
            response.raise_for_status()
            
            # Get audio data from response
            audio_data = response.content
            
            # Play the audio through phone line
            await self.play_audio(audio_data)
            
            logger.debug("TTS playback completed")
            
        except Exception as e:
            logger.error(f"TTS failed: {str(e)}", exc_info=True)
            raise AudioError(f"TTS failed: {str(e)}")
    
    async def play_audio(self, audio_data: bytes) -> None:
        """
        Play raw audio through phone line
        
        Args:
            audio_data: Raw audio bytes (8kHz, 16-bit, mono)
            
        Raises:
            AudioError: If audio playback fails
        """
        try:
            logger.debug("Playing audio through phone line")
            
            # Send audio to phone API
            response = await self._http_client.post(
                f"{self.rest_url}/play-audio",
                content=audio_data,
                headers={"Content-Type": "application/octet-stream"}
            )
            response.raise_for_status()
            
            logger.debug("Audio playback completed")
            
        except Exception as e:
            logger.error(f"Audio playback failed: {str(e)}", exc_info=True)
            raise AudioError(f"Audio playback failed: {str(e)}")
    
    async def play_tone(self, frequency: int, duration: int) -> None:
        """
        Play a tone through phone line
        
        Args:
            frequency: Tone frequency in Hz
            duration: Tone duration in milliseconds
            
        Raises:
            AudioError: If tone generation fails
        """
        try:
            logger.debug(f"Generating tone: {frequency}Hz for {duration}ms")
            
            # Send tone generation request to phone API
            response = await self._http_client.post(
                f"{self.rest_url}/generate-tone",
                json={
                    "frequency": frequency,
                    "duration": duration
                }
            )
            response.raise_for_status()
            
            logger.debug("Tone playback completed")
            
        except Exception as e:
            logger.error(f"Tone generation failed: {str(e)}", exc_info=True)
            raise AudioError(f"Tone generation failed: {str(e)}")
    
    async def start_voice_recognition(self) -> None:
        """
        Start voice recognition mode
        
        Raises:
            AudioError: If voice recognition fails to start
        """
        try:
            logger.debug("Starting voice recognition")
            
            # Send voice recognition request to phone API
            response = await self._http_client.post(
                f"{self.rest_url}/voice-recognition/start"
            )
            response.raise_for_status()
            
            logger.debug("Voice recognition started")
            
        except Exception as e:
            logger.error(f"Failed to start voice recognition: {str(e)}", exc_info=True)
            raise AudioError(f"Failed to start voice recognition: {str(e)}")
    
    async def stop_voice_recognition(self) -> None:
        """
        Stop voice recognition mode
        
        Raises:
            AudioError: If voice recognition fails to stop
        """
        try:
            logger.debug("Stopping voice recognition")
            
            # Send stop request to phone API
            response = await self._http_client.post(
                f"{self.rest_url}/voice-recognition/stop"
            )
            response.raise_for_status()
            
            logger.debug("Voice recognition stopped")
            
        except Exception as e:
            logger.error(f"Failed to stop voice recognition: {str(e)}", exc_info=True)
            raise AudioError(f"Failed to stop voice recognition: {str(e)}")
    
    async def close(self) -> None:
        """Clean up resources"""
        await self._http_client.aclose()
        logger.debug("AudioService closed")

# Example usage:
#
# audio = AudioService(config)
#
# # Text-to-speech
# await audio.speak("Timer complete")
#
# # Play tone
# await audio.play_tone(1000, 500)  # 1kHz tone for 500ms
#
# # Voice recognition
# await audio.start_voice_recognition()
# # ... process voice input ...
# await audio.stop_voice_recognition()
#
# # Cleanup
# await audio.close()
