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
}

export interface LogConfig {
    level: LogLevel;
    file?: string;
    console: boolean;
    format?: 'json' | 'text';
    maxFiles?: number;
    maxSize?: string;
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

// Logging types
export type LogLevel = typeof LOG_LEVELS[number];

// Hardware event interface
export interface HardwareEvent extends BaseEvent {
    deviceId: string;
    status: 'connected' | 'disconnected' | 'error';
    error?: Error;
}

// Re-export essential types
export * from './errors';
export type { LogLevel, LogMetadata } from './logging';
export type { HardwareConfig } from './hardware-config';

export interface AudioConfig {
    sampleRate: number;
    channels: number;
    bitDepth: number;
    bufferSize?: number;
}

export interface ServiceConfig extends BaseConfig {
    app: AppConfig;
    hardware: HardwareConfig; 
    logging: LogConfig;
}
