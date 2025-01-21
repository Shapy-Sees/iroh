// src/core/index.ts
//
// Key Features:
// - Core application initialization
// - Service coordination
// - Event bus management
// - State management
// - Core configuration validation

import { Config } from '../types';
import { logger } from '../utils/logger';
import { EventBus } from './event-bus';
import { StateManager } from './state-manager';

export class IrohCore {
    private config: Config;
    private eventBus: EventBus;
    private state: StateManager;
    private isInitialized: boolean = false;

    constructor(config: Config) {
        this.config = config;
        this.eventBus = new EventBus();
        this.state = new StateManager();
    }

    public async initialize(): Promise<void> {
        if (this.isInitialized) {
            return;
        }

        logger.info('Initializing Iroh core...');

        try {
            await this.validateConfig();
            await this.state.initialize();
            this.setupEventHandlers();
            
            this.isInitialized = true;
            logger.info('Iroh core initialized successfully');
        } catch (error) {
            logger.error('Failed to initialize Iroh core:', error);
            throw error;
        }
    }

    private async validateConfig(): Promise<void> {
        // Validate core configuration requirements
        if (!this.config.app.name || !this.config.app.port) {
            throw new Error('Invalid core configuration');
        }
    }

    private setupEventHandlers(): void {
        // Setup core event handlers
        this.eventBus.on('stateChange', this.handleStateChange.bind(this));
    }

    private async handleStateChange(change: any): Promise<void> {
        await this.state.update(change);
    }

    public getEventBus(): EventBus {
        return this.eventBus;
    }

    public getState(): StateManager {
        return this.state;
    }

    public async shutdown(): Promise<void> {
        logger.info('Shutting down Iroh core...');
        
        try {
            await this.state.save();
            this.eventBus.removeAllListeners();
            this.isInitialized = false;
            
            logger.info('Iroh core shutdown complete');
        } catch (error) {
            logger.error('Error during core shutdown:', error);
            throw error;
        }
    }
}

export { EventBus } from './event-bus';
export { StateManager } from './state-manager';