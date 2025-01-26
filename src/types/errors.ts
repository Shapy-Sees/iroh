import { Result } from './index';

export class IrohError extends Error {
    constructor(message: string, public code: string) {
        super(message);
        this.name = 'IrohError';
    }
}

export class HardwareError extends IrohError {
    constructor(message: string) {
        super(message, 'HARDWARE_ERROR');
        this.name = 'HardwareError';
    }
}

export class ServiceError extends IrohError {
    constructor(message: string) {
        super(message, 'SERVICE_ERROR');
        this.name = 'ServiceError';
    }
}

export class ConfigurationError extends IrohError {
    constructor(message: string) {
        super(message, 'CONFIG_ERROR');
        this.name = 'ConfigurationError';
    }
}

/**
 * State management errors
 */
export class StateError extends IrohError {
    constructor(message: string, details?: Record<string, any>) {
        super(message, 'STATE_ERROR');
        this.name = 'StateError';
    }
}

/**
 * Input/config validation errors
 */
export class ValidationError extends IrohError {
    constructor(message: string, details?: Record<string, any>) {
        super(message, 'VALIDATION_ERROR');
        this.name = 'ValidationError';
    }
}

// Helper function to ensure unknown errors are properly wrapped
export function ensureError(error: unknown): Error {
    if (error instanceof Error) return error;
    return new Error(typeof error === 'string' ? error : JSON.stringify(error));
}
