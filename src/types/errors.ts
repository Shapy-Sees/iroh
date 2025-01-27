// src/types/errors.ts

import { Result } from './core';

export enum ErrorSeverity {
    LOW = 'low',
    MEDIUM = 'medium',
    HIGH = 'high',
    CRITICAL = 'critical'
}

export interface ErrorContext {
    component: string;
    operation: string;
    severity?: ErrorSeverity;
    timestamp?: Date;
    metadata?: Record<string, any>;
}

export interface ErrorDetails {
    code: string;
    context?: Record<string, unknown>;
    timestamp?: string;
    severity?: ErrorSeverity;
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

// Improved utility functions
export function ensureError(error: unknown): Error {
    if (error instanceof Error) return error;
    
    if (typeof error === 'string') {
        return new Error(error);
    }
    
    return new Error(
        error === null || error === undefined
            ? 'Unknown error occurred'
            : JSON.stringify(error, null, 2)
    );
}

export function isIrohError(error: unknown): error is IrohError {
    return error instanceof IrohError && 'code' in error && 'timestamp' in error;
}

export function getErrorSeverity(error: Error): ErrorSeverity {
    if (error instanceof HardwareError) return ErrorSeverity.HIGH;
    if (error instanceof ServiceError) return ErrorSeverity.MEDIUM;
    if (error instanceof IrohError) return ErrorSeverity.LOW;
    return ErrorSeverity.MEDIUM;
}
