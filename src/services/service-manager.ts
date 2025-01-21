// src/services/service-manager.ts
//
// Fixed implementation of the service manager with proper error handling
// and type safety improvements

import { EventEmitter } from 'events';
import { IrohAIService } from './ai/ai-service';
import { MusicService } from './music/music-service';
import { HomeService } from './home/home-service';
import { Config } from '../types';
import { logger } from '../utils/logger';

export class ServiceManager extends EventEmitter {
    private ai: IrohAIService;
    private music: MusicService;
    private home: HomeService;
    private isInitialized: boolean = false;

    constructor(private config: Config) {
        super();
        // Initialize AI service with required config
        this.ai = new IrohAIService({
            ...config.ai,
            elevenlabsKey: process.env.ELEVENLABS_API_KEY || ''
        });
        
        // Initialize other services
        this.music = new MusicService(config.music);
        this.home = new HomeService(config.home);
    }

    public getAIService(): IrohAIService {
        return this.ai;
    }

    public async initialize(): Promise<void> {
        try {
            logger.info('Initializing services...');

            // Initialize AI service with complete config
            this.ai = new IrohAIService({
                ...this.config.ai,
                elevenlabsKey: process.env.ELEVENLABS_API_KEY || ''
            });

            // Set up cross-service event handlers
            this.setupEventHandlers();

            this.isInitialized = true;
            logger.info('Services initialized successfully');
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            logger.error('Failed to initialize services:', err);
            throw err;
        }
    }

    private setupEventHandlers(): void {
        // Handle music state changes
        this.music.on('stateChange', async (state) => {
            try {
                await this.updateAIContext('musicState', state);
            } catch (error) {
                const err = error instanceof Error ? error : new Error(String(error));
                logger.error(`Failed to update AI context for musicState:`, err);
            }
        });

        // Handle home automation state changes
        this.home.on('stateChange', async (state) => {
            try {
                await this.updateAIContext('homeState', state);
            } catch (error) {
                const err = error instanceof Error ? error : new Error(String(error));
                logger.error(`Failed to update AI context for homeState:`, err);
            }
        });
    }

    private async updateAIContext(context: string, state: any): Promise<void> {
        try {
            const aiContext = `Current ${context}: ${JSON.stringify(state)}`;
            await this.ai.processText(aiContext);
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            logger.error(`Failed to update AI context for ${context}:`, err);
        }
    }

    // Handle voice commands and route to appropriate service
    public async handleCommand(command: string, audio?: Buffer): Promise<void> {
        try {
            // Process with AI to determine intent
            const response = audio ? 
                await this.ai.processVoice(audio) :
                await this.ai.processText(command);

            // Parse intent and route to appropriate service
            const intent = this.parseIntent(response);
            await this.routeCommand(intent);

        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            logger.error('Error handling command:', err);
            throw err;
        }
    }

    private parseIntent(response: string): CommandIntent {
        // Simple intent parsing based on keywords
        if (response.includes('play') || response.includes('music')) {
            return { service: 'music', action: response };
        } else if (response.includes('light') || response.includes('temperature')) {
            return { service: 'home', action: response };
        }
        return { service: 'ai', action: response };
    }

    private async routeCommand(intent: CommandIntent): Promise<void> {
        switch (intent.service) {
            case 'music':
                await this.music.executeCommand(intent.action);
                break;
            case 'home':
                await this.home.executeCommand(intent.action);
                break;
            case 'ai':
                // Generate response through AI
                const response = await this.ai.processText(intent.action);
                const speech = await this.ai.generateSpeech(response);
                this.emit('response', speech);
                break;
        }
    }

    public async shutdown(): Promise<void> {
        logger.info('Shutting down services...');
        
        try {
            await Promise.all([
                this.ai.shutdown(),
                // Add shutdown calls for other services when implemented
            ]);
            
            this.isInitialized = false;
            logger.info('Services shut down successfully');
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            logger.error('Error during shutdown:', err);
            throw err;
        }
    }
}

interface CommandIntent {
    service: 'music' | 'home' | 'ai';
    action: string;
}