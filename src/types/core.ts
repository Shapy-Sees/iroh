// src/types/core.ts
//
// Core type definitions used across the entire application.
// Provides fundamental interfaces and types for services, configuration,
// events, and common data structures.

import { LogLevel } from './logging';

// Basic service states and status
export type ServiceState = 'initializing' | 'ready' | 'error' | 'shutdown' | 'maintenance';

export interface ServiceStatus {
    state: ServiceState;
    isHealthy: boolean;
    lastError?: Error;
    lastUpdate?: Date;
}

// Base configuration interfaces
export interface BaseConfig {
    enabled?: boolean;
    retryAttempts?: number;
    timeout?: number;
}

// Audio configuration
export interface AudioConfig {
    sampleRate: number;
    channels: number;
    bitDepth: number;
    format?: 'linear' | 'alaw' | 'ulaw';
    bufferSize?: number;
    vadThreshold?: number;
    silenceThreshold?: number;
}

// AI service configuration
export interface AIConfig extends BaseConfig {
    anthropicKey: string;
    elevenLabsKey?: string;
    openAIKey?: string;
    maxTokens?: number;
    temperature?: number;
    voiceId?: string;
    models?: {
        default: string;
        chat: string;
        embedding: string;
    };
}

// Home Assistant configuration
export interface HomeConfig extends BaseConfig {
    url: string;
    token: string;
    entityPrefix?: string;
    updateInterval?: number;
    homekitBridge?: {
        pin: string;
        name: string;
        port: number;
    };
}

// Music service configuration
export interface MusicConfig extends BaseConfig {
    spotifyClientId?: string;
    spotifyClientSecret?: string;
    defaultVolume?: number;
    crossfadeDuration?: number;
}

// Timer service configuration
export interface TimerConfig extends BaseConfig {
    maxTimers: number;
    maxDuration: number;
}

// Logging configuration
export interface LogConfig {
    level: LogLevel;
    directory: string;
    maxFiles: string;
    maxSize: string;
    console?: boolean;
    timestamps?: boolean;
}

// Cache configuration
export interface CacheOptions {
    ttl?: number;
    namespace?: string;
    maxSize?: number;
    persistToDisk?: boolean;
}

// Main service configuration
export interface ServiceConfig {
    app: {
        name: string;
        env: string;
        port: number;
    };
    hardware: {
        audio: AudioConfig;
        dahdi: DAHDIConfig;
    };
    ai: AIConfig;
    home: HomeConfig;
    music: MusicConfig;
    logging: LogConfig;
    cache: CacheOptions;
}

// Event system types
export interface BaseEvent {
    type: string;
    timestamp: number;
    metadata?: Record<string, unknown>;
}

// Result type for operations
export interface Result<T, E = Error> {
    success: boolean;
    data?: T;
    error?: E;
    metadata?: Record<string, unknown>;
}

// Cache types
export interface CacheItem<T> {
    value: T;
    expires: number;
}

export interface CacheEvents {
    set: (data: { key: string; value: any }) => void;
    delete: (data: { key: string }) => void;
    clear: () => void;
    expire: (data: { key: string }) => void;
}

// Phone related types
export interface PhoneConfig {
    hardware: {
        devicePath: string;
        audioFormat: AudioConfig;
        channel: number;
    };
    audio: {
        format: AudioConfig;
        [key: string]: any;
    };
}

// Hardware types
export interface DAHDIConfig {
    devicePath: string;
    controlPath: string;
    sampleRate: 8000;  // Must be 8kHz for DAHDI
    channels: 1;       // Must be mono for DAHDI
    bitDepth: 16;      // Must be 16-bit for DAHDI
    bufferSize: number;
    channel: number;
    monitorInterval?: number;
    audio?: {
        echoCancellation?: {
            enabled: boolean;
            taps: number;
        };
    };
}

// Success feedback types
export interface SuccessMessage {
    message: string;
    celebration?: string;
    wisdom?: string;
}

export interface SuccessContext {
    operation: string;
    duration?: number;
    achievement?: string;
    consecutiveSuccesses?: number;
}

export interface TonePattern {
    frequency?: number;
    duration?: number;
    pause?: number;
    level?: number;
}

// Common event handler type
export type EventHandler = (event: BaseEvent) => Promise<void>;

// Error handling types
export interface ErrorContext {
    component: string;
    operation: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    retryCount?: number;
    isRecoverable?: boolean;
    metadata?: Record<string, unknown>;
}

// Export key types from other files to maintain backwards compatibility
export * from './services';
export * from './errors';
export * from './logging';
export * from './hardware';