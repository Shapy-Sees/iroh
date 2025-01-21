// src/controllers/phone-feedback.ts
//
// Key Features:
// - Voice feedback for commands
// - Integration with AI service
// - Customizable responses
// - Caching for common responses
// - Non-blocking feedback
// - Fallback to tones if TTS fails
//
// Usage:
// const feedback = new PhoneFeedback(aiService);
// await feedback.acknowledge('1', 'toggleLights');

import { IrohAIService } from '../services/ai/ai-service';
import { Cache } from '../utils/cache';
import { logger } from '../utils/logger';

interface FeedbackConfig {
    enableVoice: boolean;
    cacheResponses: boolean;
    maxCacheAge: number;  // milliseconds
}

export class PhoneFeedback {
    private ai: IrohAIService;
    private cache: Cache;
    private readonly config: FeedbackConfig;
    
    // Pre-defined response templates
    private readonly templates = {
        acknowledge: [
            "Ah, {command}. A wise choice.",
            "Very well, I'll help you with {command}.",
            "As you wish. {command} it is.",
            "I'll take care of {command} for you.",
            "A fine selection. Let me handle {command}."
        ],
        error: [
            "I apologize, but I couldn't complete that request.",
            "Even the strongest tea takes time to steep. Let's try that again.",
            "Patience, friend. Something went wrong there."
        ],
        greeting: [
            "Welcome back. How may I assist you today?",
            "Ah, perfect timing. I just brewed some tea.",
            "Good to hear from you. What guidance do you seek?"
        ]
    };

    constructor(ai: IrohAIService, config?: Partial<FeedbackConfig>) {
        this.ai = ai;
        this.config = {
            enableVoice: true,
            cacheResponses: true,
            maxCacheAge: 24 * 60 * 60 * 1000, // 24 hours
            ...config
        };

        this.cache = new Cache({ ttl: this.config.maxCacheAge });
    }

    public async acknowledge(digit: string, command: string): Promise<Buffer> {
        try {
            // Check cache first
            const cacheKey = `ack_${digit}_${command}`;
            if (this.config.cacheResponses) {
                const cached = await this.cache.get(cacheKey);
                if (cached) {
                    return cached;
                }
            }

            // Generate response text
            const template = this.getRandomTemplate('acknowledge');
            const text = template.replace('{command}', this.humanizeCommand(command));

            // Generate speech
            const audio = await this.generateSpeech(text);

            // Cache the response
            if (this.config.cacheResponses) {
                await this.cache.set(cacheKey, audio);
            }

            return audio;
        } catch (error) {
            logger.error('Error generating feedback:', error);
            throw error;
        }
    }

    public async greet(): Promise<Buffer> {
        try {
            const template = this.getRandomTemplate('greeting');
            return await this.generateSpeech(template);
        } catch (error) {
            logger.error('Error generating greeting:', error);
            throw error;
        }
    }

    public async error(): Promise<Buffer> {
        try {
            const template = this.getRandomTemplate('error');
            return await this.generateSpeech(template);
        } catch (error) {
            logger.error('Error generating error message:', error);
            throw error;
        }
    }

    private getRandomTemplate(type: keyof typeof this.templates): string {
        const templates = this.templates[type];
        const index = Math.floor(Math.random() * templates.length);
        return templates[index];
    }

    private humanizeCommand(command: string): string {
        // Convert camelCase to readable text
        return command
            .replace(/([A-Z])/g, ' $1')
            .replace(/^./, str => str.toUpperCase())
            .replace(/([A-Z])\s(?=[A-Z][a-z])/g, '$1');
    }

    private async generateSpeech(text: string): Promise<Buffer> {
        if (!this.config.enableVoice) {
            throw new Error('Voice feedback is disabled');
        }

        try {
            return await this.ai.generateSpeech(text);
        } catch (error) {
            logger.error('Failed to generate speech:', error);
            throw error;
        }
    }
}

// Update PhoneController to use feedback
export class PhoneController extends EventEmitter {
    private feedback: PhoneFeedback;

    constructor(config: PhoneControllerConfig) {
        super();
        
        // Initialize AI service for feedback
        const ai = new IrohAIService(config.ai);
        this.feedback = new PhoneFeedback(ai);

        // ... rest of constructor ...
    }

    private async handleCommand(sequence: string, command: string): Promise<void> {
        try {
            // Execute the command
            await this.executeCommand(sequence);

            // Provide voice feedback
            const response = await this.feedback.acknowledge(sequence, command);
            await this.fxs.playAudio(response);

        } catch (error) {
            logger.error('Error handling command:', error);
            const errorResponse = await this.feedback.error();
            await this.fxs.playAudio(errorResponse);
        }
    }

    private async handleOffHook(): Promise<void> {
        logger.info('Phone off hook');
        this.isActive = true;

        try {
            // Play greeting
            const greeting = await this.feedback.greet();
            await this.fxs.playAudio(greeting);
        } catch (error) {
            logger.error('Error playing greeting:', error);
            await this.playFeedbackTone('dial');
        }
    }
}

// Example usage:
async function example() {
    const phoneController = new PhoneController({
        fxs: {
            devicePath: '/dev/ttyUSB0',
            sampleRate: 8000
        },
        audio: {
            bufferSize: 320,
            channels: 1,
            bitDepth: 16
        },
        ai: {
            anthropicKey: 'your-key',
            elevenLabsKey: 'your-key',
            voiceId: 'uncle-iroh'
        }
    });

    // The controller will now provide voice feedback for all commands
    phoneController.on('command', async (sequence) => {
        console.log(`Command received: ${sequence}`);
        // Voice feedback is handled automatically
    });

    await phoneController.start();
}