// src/types/errors.ts
//
// Core error class definitions for the Iroh project.
// Provides strongly-typed error hierarchy for all components.

// Base error for all Iroh errors
export class IrohError extends Error {
    constructor(
        message: string,
        public code: string,
        public details?: Record<string, any>
    ) {
        super(message);
        this.name = 'IrohError';
    }
}

// Hardware-related errors
export class HardwareError extends IrohError {
    constructor(message: string, details?: Record<string, any>) {
        super(message, 'HARDWARE_ERROR', details);
        this.name = 'HardwareError';
    }
}

// Service-related errors
export class ServiceError extends IrohError {
    constructor(message: string, details?: Record<string, any>) {
        super(message, 'SERVICE_ERROR', details);
        this.name = 'ServiceError';
    }
}

// Configuration errors
export class ConfigurationError extends IrohError {
    constructor(message: string, details?: Record<string, any>) {
        super(message, 'CONFIG_ERROR', details);
        this.name = 'ConfigurationError';
    }
}

// Audio processing errors
export class AudioError extends IrohError {
    constructor(message: string, details?: Record<string, any>) {
        super(message, 'AUDIO_ERROR', details);
        this.name = 'AudioError';
    }
}

// DAHDI-specific errors
export class DAHDIError extends HardwareError {
    constructor(message: string, details?: Record<string, any>) {
        super(message, { ...details, source: 'DAHDI' });
        this.name = 'DAHDIError';
    }
}

// Audio format errors
export class AudioFormatError extends AudioError {
    constructor(message: string, details?: Record<string, any>) {
        super(message, details);
        this.name = 'AudioFormatError';
    }
}

// Helper function to ensure unknown errors are properly wrapped
export function ensureError(error: unknown): Error {
    if (error instanceof Error) {
        return error;
    }
    return new Error(typeof error === 'string' ? error : JSON.stringify(error));
}