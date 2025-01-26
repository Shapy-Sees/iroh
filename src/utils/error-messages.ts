// src/utils/error-messages.ts
//
// Centralized error message system with consistent formatting
// and context-aware responses

import { ErrorSeverity } from './error-handler';

export interface ErrorMessage {
    message: string;
    suggestion: string;
    teaMetaphor: string;
}

export interface ErrorContext {
    severity: ErrorSeverity;
    component: string;
    operation: string;
    retryCount: number;
    isRecoverable: boolean;
    metadata?: Record<string, any>;
}

// Message templates for different components and severities
const ERROR_MESSAGES: Record<string, Record<ErrorSeverity, ErrorMessage[]>> = {
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
        // ... similar structure for service errors
    },
    ai: {
        // ... similar structure for AI errors
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

export class ErrorMessageFormatter {
    private getMessageTemplate(context: ErrorContext): ErrorMessage {
        const componentMessages = ERROR_MESSAGES[context.component];
        if (!componentMessages) {
            return this.getGenericMessage(context);
        }

        const severityMessages = componentMessages[context.severity];
        if (!severityMessages?.length) {
            return this.getGenericMessage(context);
        }

        return severityMessages[context.retryCount % severityMessages.length];
    }

    private getGenericMessage(context: ErrorContext): ErrorMessage {
        return {
            message: "Like an unexpected guest at tea time, we've encountered a small surprise.",
            suggestion: "Shall we try a different approach?",
            teaMetaphor: "Every challenge is an opportunity to brew a better cup of tea."
        };
    }

    public formatErrorMessage(context: ErrorContext): string {
        const template = this.getMessageTemplate(context);
        
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
}

// Export singleton instance
export const errorMessageFormatter = new ErrorMessageFormatter();

// Example usage:
/*
const message = errorMessageFormatter.formatErrorMessage({
    severity: ErrorSeverity.MEDIUM,
    component: 'hardware',
    operation: 'connect',
    retryCount: 0,
    isRecoverable: true
});

const recoveryMessage = errorMessageFormatter.formatRecoveryMessage(true);
*/