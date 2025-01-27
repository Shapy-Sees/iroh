// src/types/core.ts
//
// Core type definitions used across the entire application
// Provides fundamental interfaces and types for services, configuration,
// events, and common data structures.

import { LogLevel } from './logging';
import { AudioFormat } from './hardware/audio';
import { DAHDIConfig } from './hardware/dahdi';

// Service status and state types
export type ServiceState = 'initializing' | 'ready' | 'error' | 'shutdown' | 'maintenance';

export interface ServiceStatus {
    state: ServiceState;
    isHealthy: boolean;
    lastError?: Error;
    lastUpdate?: Date;
}

// Base configuration types
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

// Core configuration interface
export interface Config {
    app: {
        name: string;
        env: string;
        port: number;
    };
    hardware: {
        audio: AudioConfig;
        dahdi: DAHDIConfig;
    };
    logging: LogConfig;
    services: ServiceConfig;
}

// Service-specific configs
export interface AIConfig extends BaseConfig {
    anthropicKey: string;
    elevenLabsKey?: string;
    maxTokens?: number;
    temperature?: number;
    voiceId?: string;
}

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

export interface MusicConfig extends BaseConfig {
    spotifyClientId?: string;
    spotifyClientSecret?: string;
    defaultVolume?: number;
}

export interface TimerConfig extends BaseConfig {
    maxTimers: number;
    maxDuration: number;
}

// Overall service configuration
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
    persistToDisk: boolean;
}

// Event types
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

// Re-export key types from other modules
export * from './services';
export * from './errors';
export * from './logging';
export * from './hardware';