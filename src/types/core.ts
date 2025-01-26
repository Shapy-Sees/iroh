// Core configuration and shared types
import { Buffer } from 'buffer';

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

// Add missing type definitions
export interface AudioConfig {
    sampleRate: number;
    channels: number;
    bitDepth: number;
    bufferSize: number;
}

export interface AIConfig {
    model: string;
    apiKey: string;
    maxTokens?: number;
}

export interface MusicConfig {
    provider: 'spotify' | 'local';
    apiKey?: string;
    directory?: string;
}

export interface HomeConfig {
    url: string;
    token: string;
    entityPrefix?: string;
}

/**
 * Base error class for all Iroh errors
 */
export class IrohError extends Error {
    constructor(
        message: string,
        public code: string,
        public details?: Record<string, any>
    ) {
        super(message);
        Object.setPrototypeOf(this, new.target.prototype);
        this.name = this.constructor.name;
    }
}

/**
 * Generic hardware-related errors
 */
export class HardwareError extends IrohError {
    constructor(message: string, details?: Record<string, any>) {
        super(message, 'HARDWARE_ERROR', details);
    }
}

/**
 * Service-related errors
 */
export class ServiceError extends IrohError {
    constructor(message: string, details?: Record<string, any>) {
        super(message, 'SERVICE_ERROR', details);
    }
}

/**
 * Configuration validation errors
 */
export class ConfigurationError extends IrohError {
    constructor(message: string, details?: Record<string, any>) {
        super(message, 'CONFIG_ERROR', details);
    }
}

/**
 * State management errors
 */
export class StateError extends IrohError {
    constructor(message: string, details?: Record<string, any>) {
        super(message, 'STATE_ERROR', details);
    }
}

/**
 * Input/config validation errors
 */
export class ValidationError extends IrohError {
    constructor(message: string, details?: Record<string, any>) {
        super(message, 'VALIDATION_ERROR', details);
    }
}

/**
 * Helper function to ensure unknown errors are properly wrapped
 */
export function ensureError(error: unknown): Error {
    if (error instanceof Error) {
        return error;
    }
    return new Error(typeof error === 'string' ? error : JSON.stringify(error));
}

// Utility type for service results
export type Result<T> = {
    success: true;
    data: T;
} | {
    success: false;
    error: Error;
};

// Change to ServiceConfig for consistency
export interface ServiceConfig {
    // ... existing code ...
}

// Change to AudioConfig for consistency
export interface AudioConfig {
    // ... existing code ...
}

// Change to AIServiceConfig for consistency
export interface AIServiceConfig {
    // ... existing code ...
}

// Change to MusicServiceConfig for consistency
export interface MusicServiceConfig {
    // ... existing code ...
}

// Change to HomeServiceConfig for consistency
export interface HomeServiceConfig {
    // ... existing code ...
} 