// src/types/index.ts
//
// Core type definitions for the entire project.
// These types provide the foundation for type safety across all components
// including hardware interfaces, services, controllers, events and configuration.

import { Buffer } from 'buffer';
import { EventEmitter } from 'events';

// Audio Processing Types
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

// Hardware Interface Types
export interface DAHDIChannelParams {
    channel: number;
    signaling: string;
    echocancel?: {
        enabled: boolean;
        taps: number;
    };
    callerid?: {
        enabled: boolean;
        format: string;
    };
    impedance: number;
}

export interface DAHDIStatus {
    isOpen: boolean;
    channel: number;
    alarms: number;
    signaling: {
        type: string;
        hookstate: 'onhook' | 'offhook';
        ringing: boolean;
    };
    levels?: {
        rxLevel: number;
        txLevel: number;
    };
}

// Service Types
export interface AudioService {
    processAudio(input: AudioInput): Promise<void>;
    shutdown(): Promise<void>;
}

export interface AIServiceConfig {
    /** Anthropic API key */
    anthropicKey: string;
    /** ElevenLabs API key for voice synthesis */
    elevenLabsKey?: string;
    /** OpenAI API key for speech recognition */
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

export interface AIService {
    processText(text: string): Promise<string>;
    processVoice(audioBuffer: Buffer): Promise<string>;
    generateSpeech(text: string): Promise<Buffer>;
    processTextStreaming(text: string): Promise<void>;
    updateContext(key: string, value: any): Promise<void>;
    shutdown(): Promise<void>;
}

// Music Service Types
export interface MusicService {
    executeCommand(command: string): Promise<void>;
    play(query: string): Promise<void>;
    pause(): Promise<void>;
    next(): Promise<void>;
    previous(): Promise<void>;
    setVolume(level: number): Promise<void>;
    getStatus(): Promise<MusicStatus>;
}

export interface MusicConfig {
    spotifyClientId?: string;
    spotifyClientSecret?: string;
    appleMusicKey?: string;
}

export interface MusicStatus {
    isPlaying: boolean;
    currentTrack?: {
        title: string;
        artist: string;
        duration: number;
        position?: number;
    };
    volume: number;
    queue: number;
    repeat?: 'off' | 'track' | 'queue';
    shuffle?: boolean;
}

// Home Automation Types
export interface HomeConfig {
    homekitBridge: {
        pin: string;
        name: string;
        port: number;
        setupCode?: string;
    };
    entityPrefix?: string;
    updateInterval?: number;
}

export interface HAEntity {
    entityId: string;
    state: string;
    attributes: Record<string, any>;
    lastChanged: string;
    lastUpdated: string;
    context?: {
        id: string;
        parentId?: string;
        userId?: string;
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
    ai: {
        model?: string;
        apiKey?: string;
        temperature?: number;
    };
    dtmf?: {
        minDuration: number;
        threshold: number;
    };
}

// System Configuration Types
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
    /** Sample rate in Hz */
    sampleRate: number;
    /** Number of audio channels */
    channels: number;
    /** Bits per sample */
    bitDepth: number;
    /** Voice activity detection threshold */
    vadThreshold: number;
    /** Silence detection threshold in ms */
    silenceThreshold: number;
    /** Buffer size in samples */
    bufferSize?: number;
}

export interface AIConfig {
    /** AI model selection */
    model?: string;
    /** API key for model access */
    apiKey?: string;
    /** Generation temperature */
    temperature: number;
    /** Maximum tokens to generate */
    maxTokens: number;
    /** Voice ID for synthesis */
    voiceId: string;
    /** Anthropic API key */
    anthropicKey?: string;
    /** ElevenLabs API key */
    elevenLabsKey?: string;
    /** OpenAI API key */
    openAIKey?: string;
}

export interface LogConfig {
    /** Log level (debug/info/warn/error) */
    level: 'debug' | 'info' | 'warn' | 'error';
    /** Directory for log files */
    directory: string;
    /** Maximum log file age */
    maxFiles: string;
    /** Maximum log file size */
    maxSize: string;
    /** Whether to log to console */
    console?: boolean;
    /** Additional logging options */
    options?: Record<string, any>;
}

// Event handler types
export type EventHandler<T = any> = (data: T) => Promise<void> | void;

// Generic service status interface
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

// Event System Types
export interface EventBusConfig {
    /** Maximum events to keep in history */
    maxHistory?: number;
    /** Whether to enable debug logging */
    debug?: boolean;
    /** Event persistence options */
    persistence?: {
        enabled: boolean;
        path?: string;
    };
}

export interface EventHistoryItem<T = any> {
    /** Event type/name */
    event: string;
    /** Event payload */
    data: T;
    /** Event timestamp */
    timestamp: number;
    /** Unique event ID */
    id: string;
    /** Additional metadata */
    metadata?: Record<string, any>;
}