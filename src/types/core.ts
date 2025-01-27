import { Buffer } from 'buffer';
import { LOG_LEVELS } from '../config/constants';
import { HardwareConfig } from './hardware-config';

// Core result type
export interface Result<T, E = Error> {
    success: boolean;
    data?: T;
    error?: E;
    metadata?: Record<string, unknown>;
}

// Cache related types
export interface CacheOptions {
    ttl?: number;
    namespace?: string;
    maxSize?: number;
    persistToDisk?: boolean;
}

export interface CacheConfig extends BaseConfig {
    defaultTTL: number;
    maxSize: number;
    persistToDisk: boolean;
    directory?: string;
}

// Base configuration and status interfaces
export interface BaseConfig {
    enabled?: boolean;
    retryAttempts?: number;
    timeout?: number;
}

export interface BaseStatus {
    isHealthy: boolean;
    lastError?: Error;
    metadata?: Record<string, unknown>;
}

// Audio configuration
export interface AudioConfig {
    sampleRate: number;
    channels: number;
    bitDepth: number;
    bufferSize?: number;
    vadThreshold?: number;
    silenceThreshold?: number;
    noiseReduction?: boolean;
    echoCancellation?: boolean;
}

// Logging configuration
export interface LogConfig {
    level: LogLevel;
    file?: string;
    console: boolean;
    format?: 'json' | 'text';
    maxFiles?: number;
    maxSize?: string;
    directory?: string;
    timestamps?: boolean;
}

export type LogLevel = typeof LOG_LEVELS[number];

// Service configuration interfaces
export interface AIConfig extends BaseConfig {
    anthropicKey: string;
    elevenLabsKey: string;
    openAIKey: string;
    maxTokens: number;
    temperature: number;
    voiceId: string;
    models?: {
        default: string;
        chat: string;
        embedding: string;
    };
}

export interface MusicConfig extends BaseConfig {
    spotifyClientId?: string;
    spotifyClientSecret?: string;
    defaultVolume?: number;
    crossfadeDuration?: number;
}

export interface HomeConfig extends BaseConfig {
    homekitBridge: {
        pin: string;
        name: string;
        port: number;
    };
    mqttBroker?: {
        url: string;
        username?: string;
        password?: string;
    };
}

// Application configuration
export interface AppConfig extends BaseConfig {
    name: string;
    version: string;
    environment: 'development' | 'production' | 'test';
    port: number;
    apiKeys?: Record<string, string>;
}

// Unified configuration interface
export interface Config {
    app: AppConfig;
    hardware: HardwareConfig;
    ai: AIConfig;
    music: MusicConfig;
    home: HomeConfig;
    logging: LogConfig;
    cache: CacheConfig;
}

export interface ServiceConfig extends BaseConfig {
    app: AppConfig;
    hardware: HardwareConfig;
    logging: LogConfig;
    cache: CacheConfig;
}

// Event system types
export interface BaseEvent {
    type: string;
    timestamp: number;
    metadata?: Record<string, unknown>;
}

// Command system types
export type CommandStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface Command {
    type: string;
    id: string;
    status: CommandStatus;
    timestamp: number;
    metadata?: Record<string, unknown>;
}

export interface CommandResult<T> extends Result<T> {
    command: Command;
    duration: number;
}

// Diagnostic types
export interface DiagnosticResult {
    test: string;
    passed: boolean;
    message?: string;
    details?: Record<string, unknown>;
    timestamp?: number;
}

// Hardware event interface
export interface HardwareEvent extends BaseEvent {
    deviceId: string;
    status: 'connected' | 'disconnected' | 'error';
    error?: Error;
}

// Re-export essential types
export { ErrorSeverity } from './errors';
export type { LogMetadata } from './logging';
export type { HardwareConfig } from './hardware-config';
