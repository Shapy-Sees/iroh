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
    ai: {
        [ErrorSeverity.LOW]: [
            {
                message: "Our AI needs a moment to recalibrate, like a tea master adjusting their technique.",
                suggestion: "Let's try again with a fresh perspective.",
                teaMetaphor: "Even the most skilled tea master occasionally needs to refine their approach."
            }
        ],
        [ErrorSeverity.MEDIUM]: [
            {
                message: "The AI's thoughts are a bit clouded, like tea leaves that need to settle.",
                suggestion: "Please allow a moment for clarity to return.",
                teaMetaphor: "Just as tea leaves find their natural place, so will our solution."
            }
        ],
        [ErrorSeverity.HIGH]: [
            {
                message: "Our AI requires focused attention, like a complex tea blend that's out of balance.",
                suggestion: "We're working to restore harmony to the system.",
                teaMetaphor: "Sometimes we must carefully adjust each element to achieve the perfect blend."
            }
        ],
        [ErrorSeverity.CRITICAL]: [
            {
                message: "Our AI system needs immediate attention, like a precious tea set in jeopardy.",
                suggestion: "Please wait while we address this critical matter.",
                teaMetaphor: "In moments of crisis, we must act with both urgency and wisdom."
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