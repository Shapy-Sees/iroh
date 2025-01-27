// src/utils/error-handler.ts
//
// Centralized error handling system with proper error wrapping,
// logging, and recovery strategies.

import { 
    ErrorSeverity,
    ErrorContext,
    IrohError,
    HardwareError,
    ServiceError,
    ensureError,
    isIrohError,
    getErrorSeverity
} from '../types/errors';
import { EventEmitter } from 'events';
import { logger } from './logger';
import { createLogMetadata } from '../types/logging';

// Error handler events interface
interface ErrorHandlerEvents {
    error: (data: { error: Error; context: ErrorContext }) => void;
    criticalError: (data: { error: Error; context: ErrorContext }) => void;
    errorHandlingFailed: (data: { 
        originalError: Error; 
        handlingError: Error 
    }) => void;
}

export class ErrorHandler extends EventEmitter {
    private static instance: ErrorHandler;
    private retryCount: Map<string, number>;
    private readonly maxRetries: number;

    private constructor() {
        super();
        this.retryCount = new Map();
        this.maxRetries = 3;
        this.setupGlobalHandlers();
    }

    public static getInstance(): ErrorHandler {
        if (!ErrorHandler.instance) {
            ErrorHandler.instance = new ErrorHandler();
        }
        return ErrorHandler.instance;
    }

    private setupGlobalHandlers(): void {
        process.on('uncaughtException', (error: Error) => {
            this.handleError(error, {
                component: 'system',
                operation: 'uncaught',
                severity: ErrorSeverity.CRITICAL
            });
        });

        process.on('unhandledRejection', (reason: unknown) => {
            this.handleError(ensureError(reason), {
                component: 'system',
                operation: 'unhandledRejection',
                severity: ErrorSeverity.HIGH
            });
        });
    }

    // Type-safe event emitter
    public on<K extends keyof ErrorHandlerEvents>(
        event: K,
        listener: ErrorHandlerEvents[K]
    ): this {
        return super.on(event, listener);
    }

    public emit<K extends keyof ErrorHandlerEvents>(
        event: K,
        data: Parameters<ErrorHandlerEvents[K]>[0]
    ): boolean {
        return super.emit(event, data);
    }

    public async handleError(error: unknown, context: ErrorContext): Promise<void> {
        const wrappedError = ensureError(error);
        const severity = context.severity || this.classifyError(wrappedError);

        try {
            logger.error('Error detected', createLogMetadata('error', context.component, {
                error: wrappedError,
                severity,
                context: {
                    operation: context.operation,
                    retryCount: context.retryCount,
                    isRecoverable: context.isRecoverable
                }
            }));

            // Increment retry count
            const retryKey = `${context.component}:${context.operation}`;
            const currentRetries = this.retryCount.get(retryKey) || 0;
            this.retryCount.set(retryKey, currentRetries + 1);

            // Handle based on severity
            switch (severity) {
                case ErrorSeverity.CRITICAL:
                    await this.handleCriticalError(wrappedError, context);
                    break;
                case ErrorSeverity.HIGH:
                    await this.handleHighSeverityError(wrappedError, context);
                    break;
                default:
                    await this.handleNormalError(wrappedError, context);
            }

            // Emit error event
            this.emit('error', { error: wrappedError, context });

        } catch (handlingError) {
            logger.error('Error during error handling:', createLogMetadata('error', 'system', {
                error: ensureError(handlingError),
                context: {
                    originalError: wrappedError,
                    originalContext: context
                }
            }));
            this.emit('errorHandlingFailed', {
                originalError: wrappedError,
                handlingError: ensureError(handlingError)
            });
        }
    }

    private classifyError(error: Error): ErrorSeverity {
        return getErrorSeverity(error);
    }

    private async handleCriticalError(error: Error, context: ErrorContext): Promise<void> {
        const errorData = isIrohError(error) 
            ? { code: error.code, timestamp: error.timestamp }
            : { code: 'UNKNOWN_ERROR' };

        logger.error('Critical error detected:', {
            error: errorData,
            context
        });

        this.emit('criticalError', { error, context });

        // Notify monitoring systems
        this.emit('criticalError', { error, context });

        // Initiate graceful shutdown if needed
        if (this.shouldInitiateShutdown(error)) {
            await this.initiateGracefulShutdown();
        }
    }

    private async handleHighSeverityError(error: Error, context: ErrorContext): Promise<void> {
        logger.error('High severity error:', {
            error,
            context
        });

        const retryKey = `${context.component}:${context.operation}`;
        const retryCount = this.retryCount.get(retryKey) || 0;

        if (retryCount < this.maxRetries) {
            await this.attemptRecovery(context);
        } else {
            await this.handleCriticalError(error, {
                ...context,
                severity: ErrorSeverity.CRITICAL
            });
        }
    }

    private async handleNormalError(error: Error, context: ErrorContext): Promise<void> {
        logger.warn('Error occurred:', {
            error,
            context
        });

        // Attempt basic recovery
        await this.attemptRecovery(context);
    }

    private async attemptRecovery(context: ErrorContext): Promise<void> {
        try {
            // Implement recovery logic based on context
            logger.info('Attempting recovery', { context });
            
            // Reset retry count on successful recovery
            const retryKey = `${context.component}:${context.operation}`;
            this.retryCount.delete(retryKey);
            
        } catch (recoveryError) {
            logger.error('Recovery failed:', recoveryError);
            throw recoveryError;
        }
    }

    private shouldInitiateShutdown(error: Error): boolean {
        return error instanceof HardwareError || 
               error.message.includes('CRITICAL');
    }

    private async initiateGracefulShutdown(): Promise<void> {
        logger.warn('Initiating graceful shutdown...');
        // Implement shutdown logic
        process.exit(1);
    }

    public resetRetryCount(component: string, operation: string): void {
        this.retryCount.delete(`${component}:${operation}`);
    }
}

// Export singleton instance
export const errorHandler = ErrorHandler.getInstance();