// src/types/core.ts
//
// Core type definitions used across the entire application.
// Provides fundamental interfaces and types for services, configuration,
// events, and common data structures.

import { LogLevel } from './logging';
import { AudioFormat } from './hardware/audio';
import { DAHDIConfig } from './hardware/dahdi';
import { AIConfig, HomeConfig, MusicConfig } from './services';

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
export interface AIServiceConfig extends BaseConfig {
    anthropicKey: string;
    elevenLabsKey?: string;
    maxTokens?: number;
    temperature?: number;
    voiceId?: string;
}

// Music service configuration
export interface MusicServiceConfig extends BaseConfig {
    spotifyClientId?: string;
    spotifyClientSecret?: string;
    defaultVolume?: number;
    crossfadeDuration?: number;
}

// Timer service configuration
export interface TimerConfig extends BaseConfig {
    maxTimers: number;
    maxDuration: number; // in minutes
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
    format?: {
        colors?: boolean;
        json?: boolean;
        prettyPrint?: boolean;
    };
}

// Cache configuration
export interface CacheOptions {
    ttl?: number;
    namespace?: string;
    maxSize?: number;
    persistToDisk: boolean;
}

// Event system types
export interface BaseEvent {
    type: string;
    timestamp: number;
    metadata?: Record<string, unknown>;
}

// Cache events
export interface CacheEvents {
    set: (data: { key: string; value: any }) => void;
    delete: (data: { key: string }) => void;
    clear: () => void;
    expire: (data: { key: string }) => void;
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

// Hardware event types
export interface HardwareEvent extends BaseEvent {
    eventType: 'error' | 'status' | 'data';
    deviceId: string;
    data?: any;
}

// Diagnostic result types
export interface DiagnosticResult {
    test: string;
    passed: boolean;
    message?: string;
}

// Phone state types
export enum PhoneState {
    IDLE = 'idle',
    OFF_HOOK = 'off_hook',
    RINGING = 'ringing',
    IN_CALL = 'in_call',
    ERROR = 'error'
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
    severity: ErrorSeverity;
    retryCount?: number;
    isRecoverable?: boolean;
    metadata?: Record<string, unknown>;
}

// Re-export key types from other files to maintain backwards compatibility
export * from './services';
export * from './errors';
export * from './logging';
export * from './hardware';