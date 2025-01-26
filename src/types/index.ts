// src/types/index.ts
//
// Consolidated type definitions for the entire Iroh project.
// This is the single source of truth for all type definitions,
// providing consistent typing across all components.

import { Buffer } from 'buffer';
import { EventEmitter } from 'events';

// Core Configuration Types
export interface Config {
    app: AppConfig;
    audio: AudioConfig;
    ai: AIConfig;
    music: MusicConfig;
    home: HomeConfig;
    logging: LogConfig;
}

export interface AppConfig {
    name: string;
    env: 'development' | 'production' | 'test';
    port: number;
    dataDir?: string;
}

export interface LogConfig {
    level: 'debug' | 'info' | 'warn' | 'error';
    directory: string;
    maxFiles: string;
    maxSize: string;
    console?: boolean;
}

// Audio Processing Types
export interface AudioInput {
    sampleRate: number;
    channels: number;
    bitDepth: number;
    data: Buffer;
}

export interface AudioOutput {
    sampleRate: number;
    channels: number;
    bitDepth: number;
    data: Buffer;
    metadata?: Record<string, any>;
}

export interface DTMFEvent {
    digit: string;
    duration: number;
    timestamp: number;
    strength?: number;
}

export interface VoiceEvent {
    audio: Buffer;
    startTime: number;
    endTime: number;
    isFinal: boolean;
    confidence?: number;
}

// DAHDI Types
export interface DAHDIConfig {
    devicePath: string;
    controlPath: string;
    sampleRate: 8000;
    channels: 1;
    bitDepth: 16;
    bufferSize: number;
    channel: number;
    monitorInterval?: number;
}

export interface DAHDIChannelConfig {
    channel: number;
    signaling: 'fxs_ls' | 'fxs_gs' | 'fxs_ks';
    echocancel?: {
        enabled: boolean;
        taps: number;
    };
    callerid?: {
        enabled: boolean;
        format: 'bell' | 'v23' | 'dtmf';
    };
    impedance: 600 | 900;
}

export interface DAHDIChannelStatus {
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
export interface AIConfig {
    anthropicKey: string;
    elevenLabsKey?: string;
    openAIKey?: string;
    maxTokens?: number;
    temperature?: number;
    voiceId?: string;
}

export interface MusicConfig {
    spotifyClientId?: string;
    spotifyClientSecret?: string;
    appleMusicKey?: string;
}

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

export interface AudioConfig {
    sampleRate: 8000;
    channels: 1;
    bitDepth: 16;
    vadThreshold: number;
    silenceThreshold: number;
    bufferSize?: number;
}

// Service Interfaces
export interface AIService {
    initialize(): Promise<void>;
    processText(text: string): Promise<string>;
    processVoice(audioBuffer: Buffer): Promise<string>;
    generateSpeech(text: string): Promise<Buffer>;
    processTextStreaming(text: string): Promise<void>;
    updateContext(key: string, value: any): Promise<void>;
    shutdown(): Promise<void>;
}

export interface MusicService {
    executeCommand(command: string): Promise<void>;
    play(query: string): Promise<void>;
    pause(): Promise<void>;
    next(): Promise<void>;
    previous(): Promise<void>;
    setVolume(level: number): Promise<void>;
    getStatus(): Promise<MusicStatus>;
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
    maxHistory?: number;
    debug?: boolean;
    persistence?: {
        enabled: boolean;
        path?: string;
    };
}

export interface EventHistoryItem<T = any> {
    event: string;
    data: T;
    timestamp: number;
    id: string;
    metadata?: Record<string, any>;
}

// Service Status Types
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

// Handler Types
export type EventHandler<T = any> = (data: T) => Promise<void> | void;

// Utility type for service results
export type Result<T> = {
    success: true;
    data: T;
} | {
    success: false;
    error: Error;
};