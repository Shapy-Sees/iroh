// src/services/service-manager.ts
//
// Key Features:
// - Central service coordination
// - Service lifecycle management
// - Dependency injection
// - Error handling and recovery
// - Event coordination between services
// - Resource management

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
        this.ai = new IrohAIService(config.ai);
    }

    public getAIService(): IrohAIService {
        return this.ai;
    }

    public async initialize(): Promise<void> {
        try {
            logger.info('Initializing services...');

            // Initialize services
            this.ai = new IrohAIService(this.config.ai);
            this.music = new MusicService(this.config.music);
            this.home = new HomeService(this.config.home);

            // Set up cross-service event handlers
            this.setupEventHandlers();

            this.isInitialized = true;
            logger.info('Services initialized successfully');
        } catch (error) {
            logger.error('Failed to initialize services:', error);
            throw error;
        }
    }

    private setupEventHandlers(): void {
        // Handle music state changes
        this.music.on('stateChange', async (state) => {
            // Update AI context with music state
            await this.updateAIContext('musicState', state);
        });

        // Handle home automation state changes
        this.home.on('stateChange', async (state) => {
            // Update AI context with home state
            await this.updateAIContext('homeState', state);
        });
    }

    private async updateAIContext(context: string, state: any): Promise<void> {
        try {
            const aiContext = `Current ${context}: ${JSON.stringify(state)}`;
            await this.ai.processText(aiContext);
        } catch (error) {
            logger.error(`Failed to update AI context for ${context}:`, error);
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
            logger.error('Error handling command:', error);
            throw error;
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

    // Get status from all services
    public async getStatus(): Promise<ServiceStatus> {
        return {
            ai: { initialized: this.isInitialized },
            music: await this.music.getStatus(),
            home: await this.home.getStatus()
        };
    }

    // Graceful shutdown
    public async shutdown(): Promise<void> {
        logger.info('Shutting down services...');
        
        try {
            await Promise.all([
                this.ai.shutdown(),
                this.music.shutdown(),
                this.home.shutdown()
            ]);
            
            this.isInitialized = false;
            logger.info('Services shut down successfully');
        } catch (error) {
            logger.error('Error during shutdown:', error);
            throw error;
        }
    }
}

interface CommandIntent {
    service: 'music' | 'home' | 'ai';
    action: string;
}

interface ServiceStatus {
    ai: { initialized: boolean };
    music: any;
    home: any;
}