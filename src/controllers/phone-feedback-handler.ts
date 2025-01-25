// src/controllers/phone-feedback-handler.ts
//
// Key Features:
// - Combines voice and tone feedback
// - Manages feedback timing
// - Handles interrupt scenarios
// - Provides audio cues
// - Maintains conversation flow
// - Error state recovery

import { EventEmitter } from 'events';
import { ErrorFeedback } from '../utils/error-messages';
import { IrohAIService } from '../services/ai/ai-service';
import { logger } from '../utils/logger';
import { DAHDIInterface } from '../hardware/dahdi-interface';

interface FeedbackOptions {
    playTones: boolean;
    useVoice: boolean;
    waitForCompletion: boolean;
}

export class PhoneFeedbackHandler extends EventEmitter {
    private errorFeedback: ErrorFeedback;
    private aiService: IrohAIService;
    private dahdi: DAHDIInterface;
    private isPlaying: boolean = false;
    private feedbackQueue: Array<() => Promise<void>> = [];

    // Tone patterns for different scenarios
    private readonly tonePatterns = {
        error: [
            { frequency: 480, duration: 200 },
            { frequency: 620, duration: 200 }
        ],
        warning: [
            { frequency: 440, duration: 100 },
            { pause: 100 },
            { frequency: 440, duration: 100 }
        ],
        processing: [
            { frequency: 350, duration: 100 },
            { pause: 2000 }
        ]
    };

    constructor(aiService: IrohAIService, dahdi: DAHDIInterface) {
        super();
        this.errorFeedback = new ErrorFeedback();
        this.aiService = aiService;
        this.dahdi = dahdi;
    }

    public async handleError(error: Error, context: any, options: Partial<FeedbackOptions> = {}): Promise<void> {
        const defaultOptions: FeedbackOptions = {
            playTones: true,
            useVoice: true,
            waitForCompletion: true
        };

        const feedbackOptions = { ...defaultOptions, ...options };

        try {
            // Generate error message
            const message = await this.errorFeedback.generateFeedback(error, {
                severity: this.determineSeverity(error),
                component: context.component,
                retryCount: context.retryCount || 0,
                isRecoverable: this.isErrorRecoverable(error)
            });

            // Add feedback to queue
            await this.queueFeedback(async () => {
                if (feedbackOptions.playTones) {
                    await this.playErrorTone(context.severity);
                }

                if (feedbackOptions.useVoice) {
                    const speech = await this.aiService.generateSpeech(message);
                    await this.playAudio(speech);
                }
            }, feedbackOptions.waitForCompletion);

        } catch (feedbackError) {
            logger.error('Error providing feedback:', feedbackError);
            // Fallback to simple tone if voice feedback fails
            await this.playErrorTone('high');
        }
    }

    private async queueFeedback(
        feedback: () => Promise<void>,
        waitForCompletion: boolean
    ): Promise<void> {
        if (waitForCompletion) {
            this.feedbackQueue.push(feedback);
            if (!this.isPlaying) {
                await this.processQueue();
            }
        } else {
            await feedback();
        }
    }

    private async processQueue(): Promise<void> {
        while (this.feedbackQueue.length > 0) {
            this.isPlaying = true;
            const feedback = this.feedbackQueue.shift();
            if (feedback) {
                try {
                    await feedback();
                } catch (error) {
                    logger.error('Error processing feedback:', error);
                }
            }
        }
        this.isPlaying = false;
    }

    public async playErrorTone(severity: 'low' | 'medium' | 'high' | 'critical'): Promise<void> {
        let pattern;
        switch (severity) {
            case 'critical':
            case 'high':
                pattern = this.tonePatterns.error;
                break;
            case 'medium':
                pattern = this.tonePatterns.warning;
                break;
            default:
                pattern = this.tonePatterns.processing;
        }

        await this.playTonePattern(pattern);
    }

    private async playTonePattern(pattern: Array<any>): Promise<void> {
        for (const tone of pattern) {
            if (tone.pause) {
                await new Promise(resolve => setTimeout(resolve, tone.pause));
            } else {
                // Use DAHDI interface for tone generation
                await this.dahdi.generateTone({
                    frequency: tone.frequency,
                    duration: tone.duration,
                    level: -10  // dBm0 level for DAHDI
                });
            }
        }
    }

    private async playTone(frequency: number, duration: number): Promise<void> {
        // Implementation depends on your audio hardware interface
        this.emit('tone', { frequency, duration });
    }

    private async playAudio(audio: Buffer): Promise<void> {
        try {
            // Play through DAHDI interface
            await this.dahdi.playAudio(audio);
        } catch (error) {
            logger.error('Error playing audio through DAHDI:', error);
            throw error;
        }
    }

    public async provideProgressFeedback(progress: number): Promise<void> {
        if (progress < 1) {
            const message = this.errorFeedback.getProgressMessage(progress);
            const speech = await this.aiService.generateSpeech(message);
            await this.playAudio(speech);
        }
    }

    public async handleRecovery(success: boolean): Promise<void> {
        const message = await this.errorFeedback.handleRecovery(success);
        const speech = await this.aiService.generateSpeech(message);
        await this.playAudio(speech);
    }

    private determineSeverity(error: Error): 'low' | 'medium' | 'high' | 'critical' {
        // Implement severity determination logic based on error type
        return 'medium';
    }

    private isErrorRecoverable(error: Error): boolean {
        // Implement recoverability check logic
        return true;
    }

    public interrupt(): void {
        this.feedbackQueue = [];
        this.isPlaying = false;
        this.emit('interrupted');
    }
}

// Example integration with PhoneController
export class PhoneController {
    private feedbackHandler: PhoneFeedbackHandler;

    constructor(config: any) {
        this.feedbackHandler = new PhoneFeedbackHandler(config.ai, config.dahdi);
        this.setupFeedbackHandlers();
    }

    private setupFeedbackHandlers(): void {
        this.feedbackHandler.on('tone', async ({ frequency, duration }) => {
            try {
                // Play tone through phone hardware
                await this.playToneOnPhone(frequency, duration);
            } catch (error) {
                logger.error('Error playing tone:', error);
            }
        });

        this.feedbackHandler.on('audio', async (audio: Buffer) => {
            try {
                // Play audio through phone hardware
                await this.playAudioOnPhone(audio);
            } catch (error) {
                logger.error('Error playing audio:', error);
            }
        });

        // Handle errors with appropriate feedback
        this.on('error', async (error: Error, context: any) => {
            await this.feedbackHandler.handleError(error, context, {
                playTones: true,
                useVoice: true,
                waitForCompletion: true
            });
        });
    }

    private async playToneOnPhone(frequency: number, duration: number): Promise<void> {
        // Implementation for playing tones through phone hardware
    }

    private async playAudioOnPhone(audio: Buffer): Promise<void> {
        // Implementation for playing audio through phone hardware
    }

    // Example error handling scenario
    public async handleCommand(command: string): Promise<void> {
        try {
            // Attempt to execute command
            await this.executeCommand(command);
        } catch (error) {
            await this.feedbackHandler.handleError(error, {
                component: 'command',
                command,
                retryCount: 0
            });
        }
    }
}