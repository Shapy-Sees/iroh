// src/controllers/phone-feedback-handler.ts
//
// Manages audio and voice feedback for the phone system, coordinating between
// the DAHDI hardware interface, AI service, and tone generation.
// Handles feedback queuing, interruption, error recovery, and DAHDI format compatibility.

import { EventEmitter } from 'events';
import { DAHDIInterface } from '../hardware/dahdi-interface';
import { IrohAIService } from '../services/ai/ai-service';
import { ErrorMessages } from '../utils/error-messages';
import { logger } from '../utils/logger';
import { EVENTS, TIMEOUTS } from '../core/constants';
import { ServiceError } from '../types/core';

interface FeedbackOptions {
    /** Whether to play audio tones */
    playTones: boolean;
    /** Whether to use voice feedback */
    useVoice: boolean;
    /** Whether to wait for current feedback to complete */
    waitForCompletion: boolean;
}

interface TonePattern {
    frequency?: number;
    duration?: number;
    pause?: number;
    level?: number;
}

export class PhoneFeedbackHandler extends EventEmitter {
    private readonly dahdi: DAHDIInterface;
    private readonly aiService: IrohAIService;
    private readonly errorMessages: ErrorMessages;
    private isPlaying: boolean = false;
    private feedbackQueue: Array<() => Promise<void>> = [];
    private currentFeedback: Promise<void> | null = null;

    // DAHDI-compatible tone patterns
    private readonly tonePatterns = {
        error: [
            { frequency: 480, duration: 200, level: -10 },
            { frequency: 620, duration: 200, level: -10 }
        ],
        warning: [
            { frequency: 440, duration: 100, level: -10 },
            { pause: 100 },
            { frequency: 440, duration: 100, level: -10 }
        ],
        processing: [
            { frequency: 350, duration: 100, level: -10 },
            { pause: 2000 }
        ],
        success: [
            { frequency: 600, duration: 100, level: -10 },
            { pause: 50 },
            { frequency: 800, duration: 200, level: -10 }
        ]
    };

    constructor(dahdi: DAHDIInterface, options?: PhoneFeedbackOptions) {
        super();
        this.dahdi = dahdi;
        this.aiService = options?.aiService || new IrohAIService();
        this.errorMessages = new ErrorMessages();

        logger.info('Phone feedback handler initialized');
    }

    public async handleError(error: Error, context: any, options: Partial<FeedbackOptions> = {}): Promise<void> {
        const defaultOptions: FeedbackOptions = {
            playTones: true,
            useVoice: true,
            waitForCompletion: true
        };

        const feedbackOptions = { ...defaultOptions, ...options };

        try {
            // Generate appropriate error message
            const message = await this.errorMessages.generateFeedback(error, {
                severity: this.determineSeverity(error),
                component: context.component,
                retryCount: context.retryCount || 0,
                isRecoverable: this.isErrorRecoverable(error)
            });

            logger.debug('Providing error feedback', {
                error: error.message,
                severity: this.determineSeverity(error),
                message
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
                    this.currentFeedback = feedback();
                    await this.currentFeedback;
                } catch (error) {
                    logger.error('Error processing feedback:', error);
                } finally {
                    this.currentFeedback = null;
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

    private async playTonePattern(pattern: TonePattern[]): Promise<void> {
        for (const tone of pattern) {
            try {
                if (tone.pause) {
                    await new Promise(resolve => setTimeout(resolve, tone.pause));
                } else if (tone.frequency) {
                    await this.dahdi.generateTone({
                        frequency: tone.frequency,
                        duration: tone.duration || TIMEOUTS.DTMF,
                        level: tone.level || -10 // Default DAHDI level
                    });
                }
            } catch (error) {
                logger.error('Error playing tone pattern:', error);
                throw error;
            }
        }
    }

    private async playAudio(audio: Buffer): Promise<void> {
        try {
            // Play through DAHDI interface
            await this.dahdi.playAudio(audio, {
                sampleRate: 8000,  // DAHDI requires 8kHz
                channels: 1,       // DAHDI is mono
                bitDepth: 16,      // DAHDI uses 16-bit PCM
                format: 'linear'   // Linear PCM format
            });
        } catch (error) {
            logger.error('Error playing audio through DAHDI:', error);
            throw error;
        }
    }

    public async provideProgressFeedback(progress: number): Promise<void> {
        if (progress < 1) {
            try {
                const message = this.errorMessages.getProgressMessage(progress);
                const speech = await this.aiService.generateSpeech(message);
                await this.playAudio(speech);
            } catch (error) {
                logger.error('Error providing progress feedback:', error);
                await this.playErrorTone('low');
            }
        }
    }

    public async handleRecovery(success: boolean): Promise<void> {
        try {
            const message = await this.errorMessages.handleRecovery(success);
            const speech = await this.aiService.generateSpeech(message);
            await this.playAudio(speech);
        } catch (error) {
            logger.error('Error handling recovery feedback:', error);
            await this.playTonePattern(
                success ? this.tonePatterns.success : this.tonePatterns.error
            );
        }
    }

    private determineSeverity(error: Error): 'low' | 'medium' | 'high' | 'critical' {
        // Determine severity based on error type and context
        if (error.name.includes('DAHDI')) {
            return 'high';
        }
        if (error.name.includes('Hardware')) {
            return 'critical';
        }
        if (error.name.includes('Audio')) {
            return 'medium';
        }
        return 'low';
    }

    private isErrorRecoverable(error: Error): boolean {
        // Determine if error is recoverable based on type
        return !error.name.includes('Critical') && 
               !error.name.includes('Fatal');
    }

    public interrupt(): void {
        // Clear feedback queue and stop current feedback
        this.feedbackQueue = [];
        if (this.currentFeedback) {
            this.currentFeedback = null;
        }
        this.isPlaying = false;
        this.emit(EVENTS.SYSTEM.INTERRUPT);
    }
}