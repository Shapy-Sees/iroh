// src/types/core.ts
//
// Core type definitions used across the entire application
// Provides fundamental interfaces and types for services, configuration,
// events, and common data structures.

import { LogLevel } from './logging';
import { AudioFormat } from './hardware/audio';
import { DAHDIConfig } from './hardware/dahdi';
import { ErrorSeverity } from './errors';
import { 
  AudioConfig as HardwareAudioConfig,
  DAHDIConfig as HardwareDAHDIConfig 
} from './hardware';


// Service interfaces
export interface IService {
    initialize(): Promise<void>;
    shutdown(): Promise<void>;
    getStatus(): IServiceStatus;
    isHealthy(): boolean;
}

export interface IServiceStatus {
    state: ServiceState;
    isHealthy: boolean;
    lastError?: Error;
    lastUpdate?: Date;
}

export type ServiceState = 'initializing' | 'ready' | 'error' | 'shutdown' | 'maintenance';

// Cache interfaces
export interface CacheOptions {
    ttl?: number;
    namespace?: string;
    maxSize?: number;
    persistToDisk: boolean;
}

export interface CacheItem<T> {
    key: string;
    value: T;
    expires: number;
    namespace?: string;
  }

// Renamed base config interface to avoid conflicts
export interface IBaseConfig {
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
    app: AppConfig;
    hardware: {
        audio: AudioConfig;
        dahdi: DAHDIConfig;
    };
    services: ServiceConfig;
    logging: LogConfig;
}

export interface AppConfig {
    name: string;
    env: 'development' | 'production' | 'test';
    port: number;
}

// Service-specific configs
export interface AIConfig extends IBaseConfig {
    anthropicKey: string;
    elevenLabsKey?: string;
    maxTokens?: number;
    temperature?: number;
    voiceId?: string;
}

export interface HomeConfig extends IBaseConfig {
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

export interface MusicConfig extends IBaseConfig {
    spotifyClientId?: string;
    spotifyClientSecret?: string;
    defaultVolume?: number;
}

export interface TimerConfig extends IBaseConfig {
    maxTimers: number;
    maxDuration: number;
}

// Overall service configuration
export interface ServiceConfig {
    ai: AIConfig;
    home: HomeConfig;
    music: MusicConfig;
    timer: TimerConfig;
    hardware: HardwareDAHDIConfig;
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

export interface IBaseConfig {
    enabled?: boolean;
    retryAttempts?: number;
    timeout?: number;
}

// Status types
export interface ServiceStatus {
    state: ServiceState;
    isHealthy: boolean;
    lastError?: Error;
    lastUpdate?: Date;
    metrics?: {
      uptime: number;
      errors: number;
      warnings: number;
      lastChecked: Date;
    };
  }
  export type ServiceState = 'initializing' | 'ready' | 'error' | 'shutdown' | 'maintenance';

// Export all errors
export * from './errors';
export * from './logging';

// Re-export with renamed interfaces to avoid conflicts
export {
  AudioConfig as HardwareAudioConfig,
  DAHDIConfig as HardwareDAHDIConfig,
} from './hardware';

