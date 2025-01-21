// src/utils/error-messages.ts
//
// Key Features:
// - Friendly, Iroh-style error messages
// - Context-aware responses
// - Tea-themed metaphors
// - Calming tone
// - Helpful suggestions
// - Recovery guidance

interface ErrorMessage {
    message: string;
    suggestion?: string;
    teaMetaphor?: string;
}

interface FeedbackContext {
    severity: 'low' | 'medium' | 'high' | 'critical';
    component: string;
    retryCount: number;
    isRecoverable: boolean;
}

export class ErrorMessages {
    private readonly messages = {
        hardware: {
            low: [
                {
                    message: "Ah, it seems our connection is like a tea leaf that's yet to unfurl. Let's give it another moment.",
                    suggestion: "Perhaps we could try that again?",
                    teaMetaphor: "Sometimes the best tea needs time to steep properly."
                },
                {
                    message: "Just as a teacup may need a gentle adjustment, our connection needs a small correction.",
                    suggestion: "Shall we try once more?",
                    teaMetaphor: "Even the finest teapot occasionally needs realignment."
                }
            ],
            medium: [
                {
                    message: "Our connection is like a tea that's not quite at the right temperature.",
                    suggestion: "Let me adjust things and we'll try again shortly.",
                    teaMetaphor: "Patience is key - rushing tea only leads to bitterness."
                }
            ],
            high: [
                {
                    message: "It seems we're experiencing some turbulence in our tea garden.",
                    suggestion: "I need a moment to tend to the garden. Please hold while I restore harmony.",
                    teaMetaphor: "Even the strongest storms pass, and the garden becomes peaceful again."
                }
            ]
        },
        service: {
            low: [
                {
                    message: "Ah, a small ripple in our sea of tranquility.",
                    suggestion: "Let's take another sip of this challenge.",
                    teaMetaphor: "Like a leaf finding its way in hot water, we'll find our path."
                }
            ],
            medium: [
                {
                    message: "Our services are like leaves that need a moment to unfurl properly.",
                    suggestion: "Shall we give them a moment to reach their full potential?",
                    teaMetaphor: "Good tea can't be rushed - it needs time to release its full flavor."
                }
            ]
        },
        ai: {
            low: [
                {
                    message: "My thoughts are like ripples in a tea cup, not quite settled yet.",
                    suggestion: "Could you share that wisdom with me again?",
                    teaMetaphor: "Sometimes we must let the sediment settle to see clearly."
                }
            ],
            medium: [
                {
                    message: "Like a complex blend of tea, I need a moment to understand all the nuances.",
                    suggestion: "Would you mind rephrasing that?",
                    teaMetaphor: "Understanding, like brewing, takes time and patience."
                }
            ]
        }
    };

    private readonly recoveryMessages = [
        "Ah, balance is restored, like a perfectly steeped cup of tea.",
        "The clouds have parted, and our path is clear once again.",
        "Harmony returns, like the calm after a storm in the tea garden."
    ];

    public getErrorMessage(context: FeedbackContext): ErrorMessage {
        const componentMessages = this.messages[context.component as keyof typeof this.messages];
        if (!componentMessages) {
            return this.getGenericMessage(context);
        }

        const severityMessages = componentMessages[context.severity];
        if (!severityMessages) {
            return this.getGenericMessage(context);
        }

        // Select message based on retry count to avoid repetition
        const index = context.retryCount % severityMessages.length;
        return severityMessages[index];
    }

    private getGenericMessage(context: FeedbackContext): ErrorMessage {
        return {
            message: "Like an unexpected guest at tea time, we've encountered a small surprise.",
            suggestion: "Shall we try a different approach?",
            teaMetaphor: "Every challenge is an opportunity to brew a better cup of tea."
        };
    }

    public getRecoveryMessage(): string {
        const index = Math.floor(Math.random() * this.recoveryMessages.length);
        return this.recoveryMessages[index];
    }

    public getProgressMessage(progress: number): string {
        if (progress < 0.33) {
            return "Like heating water for tea, we're preparing...";
        } else if (progress < 0.66) {
            return "The leaves are steeping, almost ready...";
        } else {
            return "Almost there, letting the flavors develop...";
        }
    }

    public getCriticalMessage(): ErrorMessage {
        return {
            message: "Even the most serene garden sometimes needs thorough maintenance.",
            suggestion: "Please allow me a moment to restore harmony to our systems.",
            teaMetaphor: "Like a tea master tending to his garden, I must attend to some important matters."
        };
    }
}

// Example usage with error handler integration
export class ErrorFeedback {
    private messages: ErrorMessages;

    constructor() {
        this.messages = new ErrorMessages();
    }

    public async generateFeedback(error: Error, context: FeedbackContext): Promise<string> {
        const message = this.messages.getErrorMessage(context);
        
        let feedback = message.message;
        
        if (context.isRecoverable) {
            feedback += ` ${message.suggestion}`;
        }

        if (context.severity === 'medium' || context.severity === 'high') {
            feedback += ` ${message.teaMetaphor}`;
        }

        return feedback;
    }

    public async handleRecovery(success: boolean): Promise<string> {
        if (success) {
            return this.messages.getRecoveryMessage();
        } else {
            return "Perhaps we should try brewing this tea differently. Would you like to try another way?";
        }
    }
}

// Integration example
const errorFeedback = new ErrorFeedback();

// Usage examples:
async function handleServiceError() {
    const feedback = await errorFeedback.generateFeedback(
        new Error('Service unavailable'),
        {
            severity: 'medium',
            component: 'service',
            retryCount: 0,
            isRecoverable: true
        }
    );
    
    // Would output something like:
    // "Our services are like leaves that need a moment to unfurl properly. 
    // Shall we give them a moment to reach their full potential? 
    // Good tea can't be rushed - it needs time to release its full flavor."
}

async function handleHardwareError() {
    const feedback = await errorFeedback.generateFeedback(
        new Error('Hardware disconnected'),
        {
            severity: 'high',
            component: 'hardware',
            retryCount: 0,
            isRecoverable: false
        }
    );
    
    // Would output something like:
    // "It seems we're experiencing some turbulence in our tea garden.
    // Even the strongest storms pass, and the garden becomes peaceful again."
}