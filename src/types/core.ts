// src/types/core.ts
//
// Core type definitions that provide the foundation for all components
// including hardware interfaces, services, controllers, and configuration.
// This file serves as the single source of truth for common types used
// throughout the project.

import { Buffer } from 'buffer';
import { EventEmitter } from 'events';

// Audio Types
export interface AudioInput {
    /** Sample rate in Hz */
    sampleRate: number;
    /** Number of audio channels */
    channels: number;
    /** Bits per sample */
    bitDepth: number;
    /** Raw audio data */
    data: Buffer;
}

export interface AudioOutput {
    /** Sample rate in Hz */
    sampleRate: number;
    /** Number of audio channels */
    channels: number;
    /** Bits per sample */
    bitDepth: number;
    /** Raw audio data */
    data: Buffer;
    /** Additional metadata */
    metadata?: Record<string, any>;
}

export interface DTMFEvent {
    /** Detected DTMF digit */
    digit: string;
    /** Duration in milliseconds */
    duration: number;
    /** Detection timestamp */
    timestamp: number;
    /** Signal strength/confidence */
    strength?: number;
}

export interface VoiceEvent {
    /** Raw audio data */
    audio: Buffer;
    /** Start time of voice segment */
    startTime: number;
    /** End time of voice segment */
    endTime: number;
    /** Whether this is the final segment */
    isFinal: boolean;
    /** Voice confidence score (0-1) */
    confidence?: number;
}

// Hardware Interface Types
export interface DAHDIChannelConfig {
    /** DAHDI channel number */
    channel: number;
    /** Signaling type for FXS ports */
    signaling: 'fxs_ls' | 'fxs_gs' | 'fxs_ks';
    /** Echo cancellation settings */
    echocancel?: {
        enabled: boolean;
        taps: number;
    };
    /** Caller ID configuration */
    callerid?: {
        enabled: boolean;
        format: 'bell' | 'v23' | 'dtmf';
    };
    /** Line impedance (ohms) */
    impedance: 600 | 900;
}

export interface DAHDIChannelStatus {
    /** Whether channel is open */
    isOpen: boolean;
    /** Channel number */
    channel: number;
    /** Current alarm state */
    alarms: number;
    /** Signaling status */
    signaling: {
        type: string;
        hookstate: 'onhook' | 'offhook';
        ringing: boolean;
    };
    /** Audio levels */
    levels?: {
        rxLevel: number;
        txLevel: number;
    };
}

// Phone Controller Types
export interface PhoneControllerConfig {
    fxs: {
        devicePath: string;
        sampleRate: number;
        impedance?: number;
    };
    audio: {
        bufferSize: number;
        channels: number;
        bitDepth: number;
        vadThreshold?: number;
    };
    ai?: {
        model?: string;
        apiKey?: string;
        temperature?: number;
    };
    dtmf?: {
        minDuration: number;
        threshold: number;
    };
}

// Service Types
export interface AIServiceConfig {
    /** Anthropic API key */
    anthropicKey: string;
    /** ElevenLabs API key */
    elevenLabsKey?: string;
    /** OpenAI API key */
    openAIKey?: string;
    /** Model parameters */
    model?: string;
    /** Generation temperature */
    temperature?: number;
    /** Maximum tokens to generate */
    maxTokens?: number;
    /** Voice ID for synthesis */
    voiceId?: string;
}

export interface MusicConfig {
    /** Spotify credentials */
    spotifyClientId?: string;
    spotifyClientSecret?: string;
    /** Apple Music key */
    appleMusicKey?: string;
}

export interface HomeConfig {
    /** HomeKit bridge configuration */
    homekitBridge: {
        pin: string;
        name: string;
        port: number;
        setupCode?: string;
    };
    /** Entity prefix for naming */
    entityPrefix?: string;
    /** State update interval */
    updateInterval?: number;
}

// System Configuration
export interface Config {
    app: AppConfig;
    audio: AudioConfig;
    ai: AIConfig;
    music: MusicConfig;
    home: HomeConfig;
    logging: LogConfig;
}

export interface AppConfig {
    /** Application name */
    name: string;
    /** Environment (development/production/test) */
    env: 'development' | 'production' | 'test';
    /** HTTP port for web interface */
    port: number;
    /** Base directory for file storage */
    dataDir?: string;
}

export interface AudioConfig {
    /** Sample rate in Hz (must be 8000 for DAHDI) */
    sampleRate: number;
    /** Number of audio channels (must be 1 for DAHDI) */
    channels: number;
    /** Bits per sample (must be 16 for DAHDI) */
    bitDepth: number;
    /** Voice activity detection threshold */
    vadThreshold: number;
    /** Silence detection threshold in ms */
    silenceThreshold: number;
    /** Buffer size in samples */
    bufferSize?: number;
}

export interface LogConfig {
    /** Log level */
    level: 'debug' | 'info' | 'warn' | 'error';
    /** Directory for log files */
    directory: string;
    /** Maximum log file age */
    maxFiles: string;
    /** Maximum log file size */
    maxSize: string;
    /** Whether to log to console */
    console?: boolean;
}

// Error Types
export class IrohError extends Error {
    constructor(message: string, public code: string) {
        super(message);
        this.name = 'IrohError';
    }
}

export class HardwareError extends IrohError {
    constructor(message: string) {
        super(message, 'HARDWARE_ERROR');
        this.name = 'HardwareError';
    }
}

export class ServiceError extends IrohError {
    constructor(message: string) {
        super(message, 'SERVICE_ERROR');
        this.name = 'ServiceError';
    }
}

export class ConfigurationError extends IrohError {
    constructor(message: string) {
        super(message, 'CONFIG_ERROR');
        this.name = 'ConfigurationError';
    }
}

// Event Types
export type EventHandler<T = any> = (data: T) => Promise<void> | void;

// Service Status
export interface ServiceStatus {
    isInitialized: boolean;
    isHealthy: boolean;
    lastError?: Error;
    metrics: {
        uptime: number;
        errors: number;
        warnings: number;
        lastChecked?: Date;
    };
}