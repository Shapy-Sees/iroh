import { 
    SuccessMessage,
    SuccessContext,
    Result,
    TonePattern 
} from '../types/core';

import { logger } from './logger';
import { IrohAIService } from '../services/ai/ai-service';

interface SuccessMessage {
    message: string;
    celebration?: string;
    wisdom?: string;
}

interface SuccessContext {
    operation: string;
    duration?: number;
    achievement?: string;
    consecutiveSuccesses?: number;
}

export class SuccessFeedback {
    private readonly messages = {
        commands: {
            lights: [
                {
                    message: "The lights respond like flowers following the sun.",
                    wisdom: "Even small changes can brighten our entire perspective."
                },
                {
                    message: "Harmony restored through light and shadow.",
                    wisdom: "Balance is the key to inner peace."
                }
            ],
            music: [
                {
                    message: "The melody flows like a gentle stream through our garden.",
                    celebration: "Shall we take a moment to appreciate this beautiful song?",
                    wisdom: "Music, like tea, soothes the spirit and refreshes the soul."
                },
                {
                    message: "Your music choice brings warmth to the room.",
                    wisdom: "A well-chosen song is like a perfectly steeped cup of tea."
                }
            ],
            temperature: [
                {
                    message: "The temperature settles like morning dew on grass.",
                    wisdom: "Comfort, like wisdom, comes from finding the right balance."
                }
            ],
            routine: [
                {
                    message: "Your morning routine unfolds like a well-tended garden.",
                    celebration: "Everything is in perfect harmony.",
                    wisdom: "Each day is a gift, like a fresh pot of tea waiting to be savored."
                }
            ]
        },
        achievements: {
            firstTime: {
                message: "Ah, your first success! Like the first sip of a new tea blend.",
                celebration: "This is a moment worth savoring.",
                wisdom: "Every journey begins with a single step, just as every tea ceremony begins with a single leaf."
            },
            milestone: {
                message: "You've mastered this like a tea master perfects their craft.",
                celebration: "Your dedication shows in every action.",
                wisdom: "Mastery comes not from the extraordinary, but from perfecting the basics."
            },
            streak: {
                message: "Your consistency is admirable, like the daily ritual of brewing tea.",
                wisdom: "In repetition, we find both comfort and growth."
            }
        }
    };

    private readonly tonePatterns = {
        success: [
            { frequency: 600, duration: 100 },
            { pause: 50 },
            { frequency: 800, duration: 200 }
        ],
        achievement: [
            { frequency: 600, duration: 100 },
            { pause: 50 },
            { frequency: 800, duration: 100 },
            { pause: 50 },
            { frequency: 1000, duration: 200 }
        ]
    };

    public getSuccessMessage(context: SuccessContext): SuccessMessage {
        // Check for achievements first
        if (this.isFirstTime(context)) {
            return this.messages.achievements.firstTime;
        }

        if (this.isMilestone(context)) {
            return this.messages.achievements.milestone;
        }

        if (this.isStreak(context)) {
            return this.messages.achievements.streak;
        }

        // Get operation-specific message
        const operationMessages = this.messages.commands[context.operation as keyof typeof this.messages.commands];
        if (operationMessages) {
            const index = Math.floor(Math.random() * operationMessages.length);
            return operationMessages[index];
        }

        return this.getGenericSuccess();
    }

    private getGenericSuccess(): SuccessMessage {
        return {
            message: "Success flows like perfectly poured tea.",
            wisdom: "Every achievement, no matter how small, is worth celebrating."
        };
    }

    private isFirstTime(context: SuccessContext): boolean {
        return context.achievement === 'firstTime';
    }

    private isMilestone(context: SuccessContext): boolean {
        // Check if this is a significant achievement
        return context.achievement === 'milestone';
    }

    private isStreak(context: SuccessContext): boolean {
        return (context.consecutiveSuccesses || 0) > 5;
    }

    public getTonePattern(context: SuccessContext): any[] {
        return context.achievement ? 
            this.tonePatterns.achievement : 
            this.tonePatterns.success;
    }
}

export class SuccessFeedbackHandler {
    private feedback: SuccessFeedback;
    private achievements: Map<string, number>;

    constructor() {
        this.feedback = new SuccessFeedback();
        this.achievements = new Map();
    }

    public async handleSuccess(
        operation: string,
        options: {
            playTone?: boolean;
            useVoice?: boolean;
            context?: any;
        } = {}
    ): Promise<string> {
        const successContext = this.buildContext(operation);
        const message = this.feedback.getSuccessMessage(successContext);
        
        // Construct full response
        let response = message.message;
        if (message.celebration) {
            response += ` ${message.celebration}`;
        }
        if (message.wisdom) {
            response += ` ${message.wisdom}`;
        }

        // Update achievement tracking
        this.updateAchievements(operation);

        return response;
    }

    private buildContext(operation: string): SuccessContext {
        const context: SuccessContext = {
            operation,
            consecutiveSuccesses: this.achievements.get(operation) || 0
        };

        // Check for first time
        if (!this.achievements.has(operation)) {
            context.achievement = 'firstTime';
        }

        // Check for milestones
        const successes = this.achievements.get(operation) || 0;
        if (successes > 0 && successes % 10 === 0) {
            context.achievement = 'milestone';
        }

        return context;
    }

    private updateAchievements(operation: string): void {
        const current = this.achievements.get(operation) || 0;
        this.achievements.set(operation, current + 1);
    }
}

// Integration example with PhoneController
export class PhoneController {
    private successHandler: SuccessFeedbackHandler;
    private aiService: IrohAIService;

    constructor(config: any) {
        this.successHandler = new SuccessFeedbackHandler();
        this.aiService = config.ai;
    }

    public async handleCommandSuccess(command: string): Promise<void> {
        try {
            // Get success message
            const message = await this.successHandler.handleSuccess(command, {
                playTone: true,
                useVoice: true
            });

            // Generate speech
            const speech = await this.aiService.generateSpeech(message);

            // Play feedback tone
            await this.playSuccessTone(command);

            // Play voice response
            await this.playAudio(speech);

        } catch (error) {
            logger.error('Error handling success feedback:', error);
        }
    }

    private async playSuccessTone(command: string): Promise<void> {
        const pattern = new SuccessFeedback().getTonePattern({
            operation: command
        });

        for (const tone of pattern) {
            if (tone.pause) {
                await new Promise(resolve => setTimeout(resolve, tone.pause));
            } else {
                await this.playTone(tone.frequency, tone.duration);
            }
        }
    }

    private async playAudio(audio: AudioBuffer): Promise<void> {
        // Implement audio playback logic here
        // This is a placeholder implementation
        console.log('Playing audio');
    }

    private async playTone(frequency: number, duration: number): Promise<void> {
        // Implement tone generation logic here
        // This is a placeholder implementation
        console.log(`Playing tone at ${frequency}Hz for ${duration}ms`);
    }

}