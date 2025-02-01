# File: iroh/services/audio_service.py
# Audio service for the Iroh Home Management System
# Handles local text-to-speech synthesis and phone line audio playback

import os
import asyncio
import hashlib
import json
from typing import Optional, Dict, Any
import httpx
import pyttsx3
import numpy as np
from scipy import signal
import wave
import io
import threading
from pathlib import Path

from ..utils.logger import get_logger
from ..utils.config import Config

logger = get_logger(__name__)

class AudioError(Exception):
    """Custom exception for audio-related errors"""
    pass

class TTSCache:
    """
    Simple cache for TTS-generated audio files
    """
    def __init__(self, cache_dir: str, max_size: int):
        self.cache_dir = Path(cache_dir)
        self.max_size = max_size
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.cache_index = self._load_cache_index()
        
        logger.debug(f"TTS cache initialized at {cache_dir}")
    
    def _load_cache_index(self) -> Dict[str, str]:
        """Load cache index from disk"""
        index_path = self.cache_dir / "index.json"
        if index_path.exists():
            try:
                with open(index_path, 'r') as f:
                    return json.load(f)
            except Exception as e:
                logger.error(f"Failed to load cache index: {e}")
                return {}
        return {}
    
    def _save_cache_index(self) -> None:
        """Save cache index to disk"""
        index_path = self.cache_dir / "index.json"
        try:
            with open(index_path, 'w') as f:
                json.dump(self.cache_index, f)
        except Exception as e:
            logger.error(f"Failed to save cache index: {e}")
    
    def _get_cache_key(self, text: str, voice: str, rate: int, pitch: int) -> str:
        """Generate cache key from TTS parameters"""
        params = f"{text}|{voice}|{rate}|{pitch}"
        return hashlib.md5(params.encode()).hexdigest()
    
    def get(self, text: str, voice: str, rate: int, pitch: int) -> Optional[bytes]:
        """Retrieve audio from cache if available"""
        key = self._get_cache_key(text, voice, rate, pitch)
        if key in self.cache_index:
            try:
                with open(self.cache_dir / f"{key}.wav", 'rb') as f:
                    return f.read()
            except Exception as e:
                logger.error(f"Failed to read cached audio: {e}")
                return None
        return None
    
    def put(self, text: str, voice: str, rate: int, pitch: int, audio_data: bytes) -> None:
        """Store audio in cache"""
        key = self._get_cache_key(text, voice, rate, pitch)
        
        # Remove oldest entries if cache is full
        while len(self.cache_index) >= self.max_size:
            oldest_key = next(iter(self.cache_index))
            self._remove_entry(oldest_key)
        
        try:
            with open(self.cache_dir / f"{key}.wav", 'wb') as f:
                f.write(audio_data)
            self.cache_index[key] = text
            self._save_cache_index()
        except Exception as e:
            logger.error(f"Failed to cache audio: {e}")
    
    def _remove_entry(self, key: str) -> None:
        """Remove entry from cache"""
        try:
            (self.cache_dir / f"{key}.wav").unlink(missing_ok=True)
            del self.cache_index[key]
        except Exception as e:
            logger.error(f"Failed to remove cache entry: {e}")

class AudioService:
    """
    Manages local text-to-speech synthesis and phone line audio playback
    """
    def __init__(self, config: Config):
        self.config = config
        self.rest_url = config.get("phone.api.rest_url", "http://localhost:8000")
        self.tts_enabled = config.get("audio.enable_tts", True)
        
        # TTS settings
        self.voice = config.get("audio.voice", "english")
        self.rate = config.get("audio.rate", 150)
        self.pitch = config.get("audio.pitch", 100)
        self.volume = config.get("audio.volume", 0.8)
        
        # Audio format settings for phone line compatibility
        self.sample_rate = config.get("audio.sample_rate", 8000)
        self.channels = config.get("audio.channels", 1)
        self.bit_depth = config.get("audio.bit_depth", 16)
        
        # Initialize TTS engine in a separate thread
        self._tts_engine = None
        self._tts_lock = threading.Lock()
        self._init_tts_engine()
        
        # Initialize audio cache if enabled
        self.cache_enabled = config.get("audio.cache_enabled", True)
        if self.cache_enabled:
            cache_dir = config.get("audio.cache_dir", "cache/audio")
            cache_max_size = config.get("audio.cache_max_size", 100)
            self.tts_cache = TTSCache(cache_dir, cache_max_size)
        else:
            self.tts_cache = None
        
        # HTTP client for REST API
        self._http_client = httpx.AsyncClient(timeout=30.0)
        
        logger.debug("AudioService initialized")
    
    def _init_tts_engine(self) -> None:
        """Initialize pyttsx3 TTS engine"""
        try:
            self._tts_engine = pyttsx3.init()
            self._tts_engine.setProperty('rate', self.rate)
            self._tts_engine.setProperty('volume', self.volume)
            
            # Set voice if available
            voices = self._tts_engine.getProperty('voices')
            for voice in voices:
                if self.voice.lower() in voice.name.lower():
                    self._tts_engine.setProperty('voice', voice.id)
                    break
            
            logger.debug("TTS engine initialized")
        except Exception as e:
            logger.error(f"Failed to initialize TTS engine: {e}")
            raise AudioError(f"TTS engine initialization failed: {e}")
    
    def _generate_tts_audio(self, text: str) -> bytes:
        """
        Generate TTS audio with proper phone line format
        """
        with self._tts_lock:  # Thread safety for pyttsx3
            try:
                # Use BytesIO to capture audio data
                output = io.BytesIO()
                
                # Generate TTS audio
                self._tts_engine.save_to_file(text, 'temp.wav')
                self._tts_engine.runAndWait()
                
                # Read generated audio and convert to proper format
                with wave.open('temp.wav', 'rb') as wav_file:
                    # Read audio data
                    frames = wav_file.readframes(wav_file.getnframes())
                    audio_array = np.frombuffer(frames, dtype=np.int16)
                    
                    # Convert to mono if needed
                    if wav_file.getnchannels() > 1:
                        audio_array = audio_array.reshape(-1, wav_file.getnchannels())
                        audio_array = audio_array.mean(axis=1)
                    
                    # Resample to 8kHz for phone line
                    if wav_file.getframerate() != self.sample_rate:
                        samples = len(audio_array)
                        new_samples = int(samples * self.sample_rate / wav_file.getframerate())
                        audio_array = signal.resample(audio_array, new_samples)
                    
                    # Write to WAV file with correct format
                    with wave.open(output, 'wb') as out_wav:
                        out_wav.setnchannels(self.channels)
                        out_wav.setsampwidth(self.bit_depth // 8)
                        out_wav.setframerate(self.sample_rate)
                        out_wav.writeframes(audio_array.astype(np.int16).tobytes())
                
                # Clean up temporary file
                try:
                    os.remove('temp.wav')
                except Exception as e:
                    logger.warning(f"Failed to remove temporary WAV file: {e}")
                
                return output.getvalue()
                
            except Exception as e:
                logger.error(f"TTS audio generation failed: {e}")
                raise AudioError(f"TTS audio generation failed: {e}")
    
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
            
            # Check cache first if enabled
            audio_data = None
            if self.cache_enabled:
                audio_data = self.tts_cache.get(text, self.voice, self.rate, self.pitch)
                if audio_data:
                    logger.debug("Using cached TTS audio")
            
            # Generate TTS if not in cache
            if not audio_data:
                # Run TTS generation in thread pool to avoid blocking
                audio_data = await asyncio.get_event_loop().run_in_executor(
                    None, self._generate_tts_audio, text
                )
                
                # Cache the generated audio if enabled
                if self.cache_enabled:
                    self.tts_cache.put(text, self.voice, self.rate, self.pitch, audio_data)
            
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
    
    async def close(self) -> None:
        """Clean up resources"""
        await self._http_client.aclose()
        if self._tts_engine:
            self._tts_engine.stop()
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
# # Cleanup
# await audio.close()
