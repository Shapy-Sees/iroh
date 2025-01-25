// src/types/index.ts
//
// Core type definitions for the entire project.
// These types provide the foundation for type safety across all components
// including hardware interfaces, services, and controllers.

import { Buffer } from 'buffer';

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

export interface VoiceEvent {
    /** Raw audio data */
    audio: Buffer;
    /** Start time of voice segment */
    startTime: number;
    /** End time of voice segment */
    endTime: number;
    /** Whether this is the final segment */
    isFinal: boolean;
}

export interface DTMFEvent {
    /** Detected DTMF digit */
    digit: string;
    /** Duration in milliseconds */
    duration: number;
    /** Detection timestamp */
    timestamp: number;
}

// Service Interfaces
export interface AudioService {
    processAudio(input: AudioInput): Promise<void>;
    shutdown(): void;
}

// AI Service configuration and interface
export interface AIServiceConfig {
    /** Anthropic API key */
    anthropicKey: string;
    /** ElevenLabs API key for voice synthesis */
    elevenLabsKey?: string;
    /** OpenAI API key for speech recognition */
    openAIKey?: string;
    /** Model configuration */
    model?: string;
    /** Temperature for generation */
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
    shutdown(): void;
}

// Music service types
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
    };
    volume: number;
    queue: number;
}

// Home automation types
export interface HomeConfig {
    homekitBridge: {
        pin: string;
        name: string;
        port: number;
    };
}

// Phone controller types
export interface PhoneControllerConfig {
    fxs: {
        devicePath: string;
        sampleRate: number;
    };
    audio: {
        bufferSize: number;
        channels: number;
        bitDepth: number;
    };
    ai: {
        model?: string;
        apiKey?: string;
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
    };
}