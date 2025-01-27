// src/utils/error-messages.ts
//
// Centralized error message system with consistent formatting 
// and context-aware responses. Uses Uncle Iroh's wisdom
// for human-friendly error messages.

import { ErrorSeverity } from '../types/errors';
import { logger } from './logger';

export interface ErrorContext {
    severity: ErrorSeverity;
    component: string;
    operation: string;
    retryCount: number;
    isRecoverable: boolean;
    metadata?: Record<string, any>;
    timestamp?: Date;
}

interface MessageTemplate {
    message: string;
    suggestion: string;
    teaMetaphor: string;
}

// Message templates for different components and severities
const ERROR_MESSAGES: Record<string, Record<ErrorSeverity, MessageTemplate[]>> = {
    hardware: {
        [ErrorSeverity.LOW]: [
            {
                message: "Ah, it seems our connection is like a tea leaf that's yet to unfurl.",
                suggestion: "Let's give it another gentle try.",
                teaMetaphor: "Sometimes the best tea needs time to steep properly."
            },
            {
                message: "Just as a teacup may need a gentle adjustment, our connection needs a small correction.",
                suggestion: "Shall we try once more?",
                teaMetaphor: "Even the finest teapot occasionally needs realignment."
            }
        ],
        [ErrorSeverity.MEDIUM]: [
            {
                message: "Our connection is like a tea that's not quite at the right temperature.",
                suggestion: "Let me adjust things and we'll try again shortly.",
                teaMetaphor: "Patience is key - rushing tea only leads to bitterness."
            }
        ],
        [ErrorSeverity.HIGH]: [
            {
                message: "It seems we're experiencing some turbulence in our tea garden.",
                suggestion: "I need a moment to tend to the garden. Please hold while I restore harmony.",
                teaMetaphor: "Even the strongest storms pass, and the garden becomes peaceful again."
            }
        ],
        [ErrorSeverity.CRITICAL]: [
            {
                message: "Our tea ceremony requires immediate attention.",
                suggestion: "Please allow me to address this urgent matter.",
                teaMetaphor: "Like a master discovering a crack in their prized teapot, some matters cannot wait."
            }
        ]
    },
    service: {
        [ErrorSeverity.LOW]: [
            {
                message: "Our service is experiencing a minor hiccup, like a small ripple in a calm tea pond.",
                suggestion: "Let's give it another moment.",
                teaMetaphor: "Even the smallest leaf can create ripples in still water."
            }
        ],
        [ErrorSeverity.MEDIUM]: [
            {
                message: "Our service needs a brief pause, like tea that needs more steeping time.",
                suggestion: "Please allow a moment for things to settle.",
                teaMetaphor: "Good tea cannot be rushed."
            }
        ],
        [ErrorSeverity.HIGH]: [
            {
                message: "Our service requires attention, like a kettle that's whistling for too long.",
                suggestion: "We're working to restore balance quickly.",
                teaMetaphor: "Even the most turbulent water can be calmed."
            }
        ],
        [ErrorSeverity.CRITICAL]: [
            {
                message: "Our service needs immediate care, like a teapot about to boil over.",
                suggestion: "Please wait while we address this urgent matter.",
                teaMetaphor: "Sometimes we must remove the kettle from the heat entirely."
            }
        ]
    },
    system: {
        [ErrorSeverity.LOW]: [
            {
                message: "A small disturbance in our harmony, like a leaf out of place.",
                suggestion: "Let me restore the balance.",
                teaMetaphor: "Even the most orderly tea garden has its moments of chaos."
            }
        ],
        [ErrorSeverity.MEDIUM]: [
            {
                message: "Our system's flow is disrupted, like tea leaves caught in a strainer.",
                suggestion: "Allow me to clear the path.",
                teaMetaphor: "Sometimes we must pause to untangle what's blocking our way."
            }
        ],
        [ErrorSeverity.HIGH]: [
            {
                message: "Our garden needs tending to restore its peace.",
                suggestion: "Please be patient while I address this disturbance.",
                teaMetaphor: "Even the most beautiful garden requires careful maintenance."
            }
        ],
        [ErrorSeverity.CRITICAL]: [
            {
                message: "The harmony of our system has been significantly disrupted.",
                suggestion: "We must step back and assess before proceeding.",
                teaMetaphor: "When the teapot cracks, we must carefully gather the pieces."
            }
        ]
    }
};

const RECOVERY_MESSAGES = [
    {
        success: "Ah, balance is restored, like a perfectly steeped cup of tea.",
        progress: "Like heating water for tea, we're preparing...",
        failure: "Perhaps we should try brewing this tea differently."
    },
    {
        success: "The clouds have parted, and our path is clear once again.",
        progress: "The leaves are steeping, almost ready...",
        failure: "This blend may need a different approach."
    }
];

export class ErrorMessages {
    public async generateFeedback(error: Error, context: ErrorContext): Promise<string> {
        try {
            // Generate appropriate error message
            const template = this.getMessageTemplate(context);
            
            let message = template.message;

            // Add context-specific information
            if (context.retryCount > 0) {
                message += ` (Attempt ${context.retryCount + 1})`;
            }

            // Add recovery suggestion if applicable
            if (context.isRecoverable) {
                message += ` ${template.suggestion}`;
            }

            // Add tea metaphor for deeper insight
            if (context.severity === ErrorSeverity.MEDIUM || 
                context.severity === ErrorSeverity.HIGH) {
                message += ` ${template.teaMetaphor}`;
            }

            logger.debug('Generated error feedback', {
                error: error.message,
                severity: context.severity,
                message
            });

            return message;

        } catch (error) {
            logger.error('Error generating feedback:', error);
            return this.getGenericMessage(context);
        }
    }

    private getMessageTemplate(context: ErrorContext): MessageTemplate {
        const componentMessages = ERROR_MESSAGES[context.component];
        if (!componentMessages) {
            return this.getGenericTemplate(context);
        }

        const severityMessages = componentMessages[context.severity];
        if (!severityMessages?.length) {
            return this.getGenericTemplate(context);
        }

        return severityMessages[context.retryCount % severityMessages.length];
    }

    private getGenericTemplate(context: ErrorContext): MessageTemplate {
        return {
            message: "Like an unexpected guest at tea time, we've encountered a small surprise.",
            suggestion: "Shall we try a different approach?",
            teaMetaphor: "Every challenge is an opportunity to brew a better cup of tea."
        };
    }

    private getGenericMessage(context: ErrorContext): string {
        const template = this.getGenericTemplate(context);
        
        let message = template.message;

        if (context.isRecoverable) {
            message += ` ${template.suggestion}`;
        }

        if (context.severity === ErrorSeverity.MEDIUM || 
            context.severity === ErrorSeverity.HIGH) {
            message += ` ${template.teaMetaphor}`;
        }

        return message;
    }

    public formatRecoveryMessage(success: boolean, progress?: number): string {
        const template = RECOVERY_MESSAGES[Math.floor(Math.random() * RECOVERY_MESSAGES.length)];

        if (typeof progress === 'number') {
            return template.progress;
        }

        return success ? template.success : template.failure;
    }

    public getProgressMessage(progress: number): string {
        if (progress >= 1) {
            return this.formatRecoveryMessage(true);
        }
        return this.formatRecoveryMessage(false, progress);
    }

    public handleRecovery(success: boolean): string {
        return this.formatRecoveryMessage(success);
    }
}

// Export singleton instance
export const errorMessages = new ErrorMessages();