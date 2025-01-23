// src/audio/types.ts
//
// Key Features:
// - Audio input/output format definitions for DAHDI compatibility
// - Event types for DTMF and voice detection
// - Type definitions for audio processing pipeline
// - Handler type definitions for event processing

// Basic audio format definition for DAHDI-compatible audio
export interface AudioInput {
    sampleRate: number;
    channels: number;
    bitDepth: number;
    data: Buffer;
}

// Event generated when DTMF tone is detected
export interface DTMFEvent {
    /** The detected DTMF digit (0-9, *, #) */
    digit: string;
    
    /** Duration of the tone in milliseconds */
    duration: number;
    
    /** Timestamp when the tone was detected */
    timestamp: number;
}

// Event generated when voice activity is detected
export interface VoiceEvent {
    /** The captured audio data */
    audio: Buffer;
    
    /** Start time of the voice segment (Unix timestamp) */
    startTime: number;
    
    /** End time of the voice segment (Unix timestamp) */
    endTime: number;
    
    /** Whether this is the final segment of the utterance */
    isFinal: boolean;
}

// Handler type for processing audio events
export type AudioEventHandler = (event: DTMFEvent | VoiceEvent) => Promise<void>;

// Audio format specification for DAHDI
export interface DAHDIAudioFormat {
    /** Sample rate must be 8000 Hz for DAHDI */
    readonly sampleRate: 8000;
    
    /** DAHDI only supports mono audio */
    readonly channels: 1;
    
    /** DAHDI uses 16-bit linear PCM */
    readonly bitDepth: 16;
    
    /** Linear PCM format specifier */
    readonly format: 'linear';
}

// Audio processing pipeline configuration
export interface AudioPipelineConfig {
    /** Frame size in samples */
    frameSize: number;
    
    /** Whether to drop frames when pipeline is busy */
    dropFramesWhenBusy?: boolean;
    
    /** Maximum processing time per frame (ms) */
    maxProcessingTime?: number;
    
    /** Audio format configuration */
    format: DAHDIAudioFormat;
}

// Voice detection configuration
export interface VADConfig {
    /** Energy threshold for voice detection */
    threshold: number;
    
    /** Minimum speech duration (ms) */
    minSpeechDuration: number;
    
    /** Maximum speech duration (ms) */
    maxSpeechDuration: number;
    
    /** Silence duration to end speech (ms) */
    silenceThreshold: number;
}

// DTMF detection configuration
export interface DTMFConfig {
    /** Minimum duration for valid DTMF tone (ms) */
    minDuration: number;
    
    /** Energy threshold for DTMF detection */
    threshold: number;
    
    /** Frame size for DTMF analysis */
    frameSize: number;
}

// Audio buffer statistics for monitoring
export interface AudioStats {
    /** Number of frames processed */
    framesProcessed: number;
    
    /** Number of frames dropped */
    framesDropped: number;
    
    /** Average processing time per frame (ms) */
    averageProcessingTime: number;
    
    /** Maximum processing time observed (ms) */
    maxProcessingTime: number;
    
    /** Number of overruns (when processing took too long) */
    overruns: number;
}

// Audio processing errors
export class AudioProcessingError extends Error {
    constructor(
        message: string,
        public readonly code: string,
        public readonly details?: any
    ) {
        super(message);
        this.name = 'AudioProcessingError';
    }
}

// Common error codes for audio processing
export enum AudioErrorCode {
    BUFFER_OVERFLOW = 'BUFFER_OVERFLOW',
    PROCESSING_TIMEOUT = 'PROCESSING_TIMEOUT',
    INVALID_FORMAT = 'INVALID_FORMAT',
    HARDWARE_ERROR = 'HARDWARE_ERROR',
    INITIALIZATION_ERROR = 'INITIALIZATION_ERROR'
}

// Audio device capabilities from DAHDI
export interface AudioDeviceCapabilities {
    /** Supported sample rates */
    supportedSampleRates: number[];
    
    /** Supported bit depths */
    supportedBitDepths: number[];
    
    /** Whether device supports hardware DTMF detection */
    hardwareDTMF: boolean;
    
    /** Whether device supports echo cancellation */
    echoCancellation: boolean;
    
    /** Maximum number of channels */
    maxChannels: number;
}