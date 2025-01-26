// src/types/errors.ts

import { Result } from './index';

interface ErrorDetails {
    code: string;
    context?: Record<string, unknown>;
    timestamp?: string;
}

export class IrohError extends Error {
    public readonly code: string;
    public readonly timestamp: string;

    constructor(message: string, details: ErrorDetails) {
        super(message);
        this.name = 'IrohError';
        this.code = details.code;
        this.timestamp = details.timestamp || new Date().toISOString();
    }
}

export class HardwareError extends IrohError {
    constructor(message: string, details?: Partial<ErrorDetails>) {
        super(message, { code: 'HARDWARE_ERROR', ...details });
        this.name = 'HardwareError';
    }
}

export class ServiceError extends IrohError {
    constructor(message: string, details?: Partial<ErrorDetails>) {
        super(message, { code: 'SERVICE_ERROR', ...details });
        this.name = 'ServiceError';
    }
}

export class ConfigurationError extends IrohError {
    constructor(message: string, details?: Partial<ErrorDetails>) {
        super(message, { code: 'CONFIG_ERROR', ...details });
        this.name = 'ConfigurationError';
    }
}

/**
 * State management errors
 */
export class StateError extends IrohError {
    constructor(message: string, details?: Partial<ErrorDetails>) {
        super(message, { code: 'STATE_ERROR', ...details });
        this.name = 'StateError';
    }
}

/**
 * Input/config validation errors
 */
export class ValidationError extends IrohError {
    constructor(message: string, details?: Partial<ErrorDetails>) {
        super(message, { code: 'VALIDATION_ERROR', ...details });
        this.name = 'ValidationError';
    }
}

// Helper function with proper typing
export function ensureError(error: unknown): Error {
    if (error instanceof Error) return error;
    
    return new Error(
        typeof error === 'string' 
            ? error 
            : JSON.stringify(error, null, 2)
    );
}

// Type guard for IrohError
export function isIrohError(error: unknown): error is IrohError {
    return error instanceof IrohError;
}
