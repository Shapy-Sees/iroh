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

// Controller Types
export interface PhoneControllerConfig {
    fxs: {
        devicePath: string;
        sampleRate: 8000;
        impedance?: number;
    };
    audio: {
        bufferSize: number;
        channels: 1;
        bitDepth: 16;
        vadThreshold?: number;
    };
    ai?: {
        model?: string;
        apiKey?: string;
        temperature?: number;
    };
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

// Define event types for better type safety
interface DAHDIEvents {
    'ready': void;
    'error': Error;
    'audio': AudioInput;
    'hook_state': { offHook: boolean };
    'ring_start': void;
    'ring_stop': void;
    'dtmf': { digit: string; duration: number };
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

export interface DAHDIAudioFormat {
    sampleRate: 8000;
    channels: 1;
    bitDepth: 16;
    format: 'linear';
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

// Home Assistant Types
export interface HomeConfig {
    url: string;
    token: string;
    entityPrefix?: string;
    updateInterval?: number;
}

export interface HAEntity {
    entity_id: string;
    state: string;
    attributes: Record<string, any>;
    last_changed: string;
    last_updated: string;
    context?: {
        id: string;
        parent_id?: string;
        user_id?: string;
    };
}

export interface HAServiceCall {
    domain: string;
    service: string;
    target?: {
        entity_id?: string | string[];
        device_id?: string | string[];
        area_id?: string | string[];
    };
    service_data?: Record<string, any>;
}

export interface HAServiceConfig {
    url: string;
    token: string;
    entityPrefix?: string;
    updateInterval?: number;
    cacheTimeout?: number;
}

export interface HomeConfig {
    /** HomeKit bridge configuration */
    homekitBridge: {
        /** Bridge PIN code */
        pin: string;
        /** Bridge name */
        name: string;
        /** Bridge port number */
        port: number;
        /** Optional setup code */
        setupCode?: string;
    };
    /** Entity prefix for Home Assistant */
    entityPrefix?: string;
    /** Update interval in milliseconds */
    updateInterval?: number;
    /** URL for Home Assistant instance */
    url?: string;
    /** Access token for Home Assistant */
    token?: string;
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

export class DAHDIError extends HardwareError {
    constructor(message: string, public originalError?: Error) {
        super(message);
        this.name = 'DAHDIError';
    }
}

export class AudioFormatError extends HardwareError {
    constructor(message: string, public details: string[]) {
        super(message);
        this.name = 'AudioFormatError';
    }
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

// Cache Types
export interface CacheOptions {
    ttl?: number;
    maxSize?: number;
    namespace?: string;
}

export interface CacheItem<T> {
    value: T;
    expires: number;
}

export interface CacheEvents {
    'set': { key: string; value: any };
    'hit': { key: string };
    'delete': { key: string };
    'clear': void;
    'evict': { key: string };
    'expire': { key: string };
}

// Re-export all types
export * from './core';
export * from './audio';
export * from './dahdi';
export * from './services/home';
export * from './services/ai';
export * from './services/music';