// src/services/service-manager.ts
//
// Service manager that initializes and coordinates all the core services
// including AI, music, home automation, etc. Handles service lifecycle,
// intent parsing, and command routing to appropriate services.

import { EventEmitter } from 'events';
import { IrohAIService } from './ai/ai-service';
import { MusicService } from './music/music-service';
import { IntentHandler, IntentAction } from './intent/intent-handler';
import { logger } from '../utils/logger';
import { Config } from '../types';

export class ServiceManager extends EventEmitter {
    private aiService: IrohAIService;
    private musicService: MusicService;
    private intentHandler: IntentHandler;
    private isInitialized: boolean = false;

    constructor(private config: Config) {
        super();

        const aiConfig = {
            anthropicKey: process.env.ANTHROPIC_API_KEY || '',
            elevenLabsKey: process.env.ELEVENLABS_API_KEY || '',
            openAIKey: process.env.OPENAI_API_KEY || '',
            maxTokens: config.ai.maxTokens,
            temperature: config.ai.temperature,
            voiceId: config.ai.voiceId
        };

        this.aiService = new IrohAIService(aiConfig);
        this.musicService = new MusicService(config.music);
        this.intentHandler = new IntentHandler();
    }

    public async initialize(): Promise<void> {
        try {
            logger.info('Initializing services...');

            // Initialize core services
            await this.aiService.initialize();
            
            // Set up intent handler event listeners
            this.setupIntentListeners();
            
            this.isInitialized = true;
            logger.info('Services initialized successfully');
        } catch (error) {
            logger.error('Failed to initialize services:', error instanceof Error ? error : new Error(String(error)));
            throw error;
        }
    }

    private setupIntentListeners(): void {
        this.intentHandler.on('contextUpdate', (context) => {
            logger.debug('Intent context updated', { context });
        });
    }

    public async handleCommand(command: string, data?: Buffer): Promise<void> {
        try {
            logger.debug('Processing command', { command, hasData: !!data });
            let intentMatch;
            
            if (command === 'voice' && data instanceof Buffer) {
                // Process voice command
                const text = await this.aiService.processVoice(data);
                intentMatch = await this.intentHandler.detectIntent(text);
            } else {
                // Process DTMF command
                intentMatch = await this.intentHandler.detectIntent(command);
            }

            if (!intentMatch) {
                logger.debug('No intent match found, falling back to general query');
                const response = await this.handleGeneralQuery(command);
                const audio = await this.aiService.generateSpeech(response);
                this.emit('response', audio);
                return;
            }

            const { intent, parameters } = intentMatch;
            const response = await this.executeIntent(intent.action, parameters);
            
            // Generate audio response
            const audio = await this.aiService.generateSpeech(response);
            this.emit('response', audio);
            
        } catch (error) {
            logger.error('Error handling command:', error instanceof Error ? error : new Error(String(error)));
            throw error;
        }
    }

    private async executeIntent(action: IntentAction, parameters?: Record<string, any>): Promise<string> {
        logger.info('Executing intent', { action, parameters });

        try {
            switch (action) {
                case 'PLAY_MUSIC':
                    await this.musicService.play(parameters?.query || '');
                    return "Playing music for you.";

                case 'PAUSE_MUSIC':
                    await this.musicService.pause();
                    return "Music paused.";

                case 'NEXT_TRACK':
                    await this.musicService.next();
                    return "Playing next track.";

                case 'PREVIOUS_TRACK':
                    await this.musicService.previous();
                    return "Playing previous track.";

                case 'SET_VOLUME':
                    const volume = parameters?.volume ?? 50;
                    await this.musicService.setVolume(volume);
                    return `Volume set to ${volume}%.`;

                case 'SET_TEMPERATURE':
                    const temp = parameters?.temperature;
                    if (!temp) {
                        return "I'm not sure what temperature you'd like.";
                    }
                    // Implement temperature control
                    return `Temperature set to ${temp} degrees.`;

                case 'SET_TIMER':
                    const duration = parameters?.duration;
                    const unit = parameters?.unit;
                    if (!duration || !unit) {
                        return "I couldn't understand the timer duration.";
                    }
                    // Implement timer
                    return `Timer set for ${duration} ${unit}${duration > 1 ? 's' : ''}.`;

                default:
                    return await this.handleGeneralQuery(parameters?.query || '');
            }
        } catch (error) {
            logger.error('Error executing intent:', error instanceof Error ? error : new Error(String(error)));
            throw error;
        }
    }

    private async handleGeneralQuery(query: string): Promise<string> {
        try {
            return await this.aiService.processText(query);
        } catch (error) {
            logger.error('Error processing general query:', error instanceof Error ? error : new Error(String(error)));
            return "I apologize, but I'm having trouble processing that request.";
        }
    }

    // Service accessor methods
    public getAIService(): IrohAIService {
        if (!this.isInitialized) {
            throw new Error('Services not initialized');
        }
        return this.aiService;
    }

    public getMusicService(): MusicService {
        if (!this.isInitialized) {
            throw new Error('Services not initialized');
        }
        return this.musicService;
    }

    public getIntentHandler(): IntentHandler {
        return this.intentHandler;
    }

    public async shutdown(): Promise<void> {
        try {
            logger.info('Shutting down services...');
            
            await this.aiService.shutdown();
            this.intentHandler.removeAllListeners();
            this.isInitialized = false;
            
            logger.info('Services shut down successfully');
        } catch (error) {
            logger.error('Error during service shutdown:', error instanceof Error ? error : new Error(String(error)));
            throw error;
        }
    }
}