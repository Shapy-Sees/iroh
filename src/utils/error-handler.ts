// src/utils/error-handler.ts
//
// Key Features:
// - Centralized error handling
// - Error classification and prioritization
// - Recovery strategies
// - User feedback generation
// - Error logging and monitoring
// - State recovery
// - Circuit breaker implementation

import { EventEmitter } from 'events';
import { IrohError, HardwareError, ServiceError } from '../types';
import { logger } from './logger';

enum ErrorSeverity {
    LOW = 'low',       // Non-critical, can continue
    MEDIUM = 'medium', // Needs attention but not immediate
    HIGH = 'high',     // Requires immediate attention
    CRITICAL = 'critical' // System shutdown may be required
}

interface ErrorContext {
    component: string;
    operation: string;
    timestamp: Date;
    metadata?: Record<string, any>;
}

interface RecoveryStrategy {
    maxRetries: number;
    backoffMs: number;
    timeout: number;
    action: () => Promise<void>;
}

export class ErrorHandler extends EventEmitter {
    private retryCount: Map<string, number> = new Map();
    private circuitBreaker: Map<string, boolean> = new Map();
    private readonly maxRetries: number = 3;

    constructor() {
        super();
        this.setupGlobalHandlers();
    }

    private setupGlobalHandlers(): void {
        process.on('uncaughtException', this.handleUncaughtException.bind(this));
        process.on('unhandledRejection', this.handleUnhandledRejection.bind(this));
    }

    public async handleError(error: Error, context: ErrorContext): Promise<void> {
        try {
            const severity = this.classifyError(error);
            logger.error('Error detected', { error, context, severity });

            // Check circuit breaker
            if (this.isCircuitBroken(context.component)) {
                throw new Error(`Circuit breaker open for ${context.component}`);
            }

            // Increment retry count
            const retryKey = `${context.component}:${context.operation}`;
            const currentRetries = this.retryCount.get(retryKey) || 0;
            this.retryCount.set(retryKey, currentRetries + 1);

            // Handle based on severity
            switch (severity) {
                case ErrorSeverity.LOW:
                    await this.handleLowSeverityError(error, context);
                    break;
                case ErrorSeverity.MEDIUM:
                    await this.handleMediumSeverityError(error, context);
                    break;
                case ErrorSeverity.HIGH:
                    await this.handleHighSeverityError(error, context);
                    break;
                case ErrorSeverity.CRITICAL:
                    await this.handleCriticalError(error, context);
                    break;
            }

            // Reset retry count if successful
            if (currentRetries + 1 >= this.maxRetries) {
                this.circuitBreaker.set(context.component, true);
                setTimeout(() => {
                    this.circuitBreaker.set(context.component, false);
                }, 60000); // Reset after 1 minute
            }

        } catch (handlingError) {
            logger.error('Error during error handling:', handlingError);
            this.emit('errorHandlingFailed', { originalError: error, handlingError });
        }
    }

    private classifyError(error: Error): ErrorSeverity {
        if (error instanceof HardwareError) {
            return ErrorSeverity.HIGH;
        }
        if (error instanceof ServiceError) {
            return ErrorSeverity.MEDIUM;
        }
        if (error instanceof IrohError) {
            return ErrorSeverity.LOW;
        }
        return ErrorSeverity.MEDIUM;
    }

    private isCircuitBroken(component: string): boolean {
        return this.circuitBreaker.get(component) || false;
    }

    private async handleLowSeverityError(error: Error, context: ErrorContext): Promise<void> {
        logger.debug('Handling low severity error', { error, context });
        
        // Emit event for user feedback
        this.emit('userFeedback', {
            message: "I encountered a small hiccup. Let me try that again.",
            tone: 'apologetic'
        });

        // Attempt recovery
        await this.attemptRecovery({
            maxRetries: 2,
            backoffMs: 1000,
            timeout: 5000,
            action: async () => {
                // Retry the operation
                await this.retryOperation(context);
            }
        });
    }

    private async handleMediumSeverityError(error: Error, context: ErrorContext): Promise<void> {
        logger.warn('Handling medium severity error', { error, context });

        this.emit('userFeedback', {
            message: "I'm having some trouble with that request. Give me a moment to sort it out.",
            tone: 'concerned'
        });

        // Save state before recovery attempt
        const state = await this.saveState(context);

        try {
            await this.attemptRecovery({
                maxRetries: 3,
                backoffMs: 2000,
                timeout: 10000,
                action: async () => {
                    await this.restoreState(state);
                    await this.retryOperation(context);
                }
            });
        } catch (recoveryError) {
            this.emit('recoveryFailed', { error, recoveryError });
        }
    }

    private async handleHighSeverityError(error: Error, context: ErrorContext): Promise<void> {
        logger.error('Handling high severity error', { error, context });

        this.emit('userFeedback', {
            message: "I'm experiencing technical difficulties. I may need to restart some systems.",
            tone: 'serious'
        });

        try {
            // Attempt component restart
            await this.restartComponent(context.component);
            
            // Verify component health
            if (await this.verifyComponentHealth(context.component)) {
                await this.retryOperation(context);
            } else {
                throw new Error(`Component ${context.component} failed health check`);
            }
        } catch (restartError) {
            await this.handleCriticalError(restartError, context);
        }
    }

    private async handleCriticalError(error: Error, context: ErrorContext): Promise<void> {
        logger.error('Handling critical error', { error, context });

        this.emit('userFeedback', {
            message: "I need to perform some maintenance. I'll be back in a moment.",
            tone: 'urgent'
        });

        // Notify monitoring systems
        this.emit('criticalError', { error, context });

        // Attempt graceful shutdown
        try {
            await this.initiateGracefulShutdown();
        } catch (shutdownError) {
            logger.error('Failed to shutdown gracefully:', shutdownError);
            process.exit(1);
        }
    }

    private async attemptRecovery(strategy: RecoveryStrategy): Promise<void> {
        let attempt = 0;
        
        while (attempt < strategy.maxRetries) {
            try {
                await Promise.race([
                    strategy.action(),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Recovery timeout')), 
                        strategy.timeout)
                    )
                ]);
                return;
            } catch (error) {
                attempt++;
                if (attempt < strategy.maxRetries) {
                    await new Promise(resolve => 
                        setTimeout(resolve, strategy.backoffMs * attempt)
                    );
                }
            }
        }
        
        throw new Error('Recovery attempts exhausted');
    }

    private async saveState(context: ErrorContext): Promise<any> {
        // Implementation depends on your state management system
        return {};
    }

    private async restoreState(state: any): Promise<void> {
        // Implementation depends on your state management system
    }

    private async retryOperation(context: ErrorContext): Promise<void> {
        // Implementation depends on your operation retry logic
    }

    private async restartComponent(component: string): Promise<void> {
        // Implementation depends on your component management system
    }

    private async verifyComponentHealth(component: string): Promise<boolean> {
        // Implementation depends on your health check system
        return true;
    }

    private async initiateGracefulShutdown(): Promise<void> {
        // Implementation depends on your shutdown requirements
    }

    private handleUncaughtException(error: Error): void {
        logger.error('Uncaught exception:', error);
        this.handleError(error, {
            component: 'system',
            operation: 'uncaught',
            timestamp: new Date()
        });
    }

    private handleUnhandledRejection(reason: any): void {
        logger.error('Unhandled rejection:', reason);
        this.handleError(
            reason instanceof Error ? reason : new Error(String(reason)),
            {
                component: 'system',
                operation: 'unhandledRejection',
                timestamp: new Date()
            }
        );
    }
}

export const errorHandler = new ErrorHandler();