// src/services/service-manager.ts
//
// Service manager that coordinates all core services including:
// - Home Assistant integration
// - AI processing (Claude and speech synthesis)
// - Audio processing and DTMF handling
// - Hardware interface via DAHDI
// - Timer and notification management
//
// The service manager ensures proper initialization order, handles
// inter-service communication, and manages graceful shutdown.

import { EventEmitter } from 'events';
import { IrohAIService } from './ai/ai-service';
import { HAService } from './home/ha_service';
import { MusicService } from './music/music-service';
import { TimerService } from './timer/timer-service';
import { HardwareService } from './hardware/hardware-service';
import { IntentHandler, IntentAction } from './intent/intent-handler';
import { Config } from '../types';
import { logger } from '../utils/logger';
import { PhoneController } from '../controllers/phone-controller';

interface ServiceState {
    isInitialized: boolean;
    activeServices: string[];
    lastError?: Error;
}

export class ServiceManager extends EventEmitter {
    private aiService: IrohAIService;
    private homeAssistant: HAService;
    private musicService: MusicService;
    private timerService: TimerService;
    private hardwareService: HardwareService;
    private intentHandler: IntentHandler;
    private state: ServiceState;
    private readonly phoneController: PhoneController;
    private readonly home: HAService;

    constructor(
        private readonly config: Config,
        private readonly phoneController: PhoneController
    ) {
        super();
        
        this.state = {
            isInitialized: false,
            activeServices: []
        };

        // Initialize core services
        this.aiService = new IrohAIService(config.ai);
        this.homeAssistant = new HAService(config.homeAssistant);
        this.musicService = new MusicService(config.music);
        this.timerService = new TimerService(config.timer, phoneController, this.aiService);
        this.hardwareService = new HardwareService(phoneController.getFXSInterface());
        this.intentHandler = new IntentHandler();

        // Set up event handlers
        this.setupEventHandlers();

        logger.info('Service manager constructed', {
            configuredServices: Object.keys(config)
        });
    }

    private setupEventHandlers(): void {
        // Handle Home Assistant state changes
        this.homeAssistant.on('state_changed', async (event) => {
            try {
                await this.handleStateChange(event);
            } catch (error) {
                logger.error('Error handling state change:', error);
            }
        });

        // Handle timer completions
        this.timerService.on('timerComplete', async (timerId: string) => {
            try {
                await this.handleTimerComplete(timerId);
            } catch (error) {
                logger.error('Error handling timer completion:', error);
            }
        });

        // Handle intent detection results
        this.intentHandler.on('contextUpdate', (context) => {
            logger.debug('Intent context updated', { context });
        });

        // Handle hardware events
        this.hardwareService.on('hardware_error', async (error: Error) => {
            logger.error('Hardware error detected:', error);
            await this.handleHardwareError(error);
        });
    }

    public async getHAEntityStatus(entity: string): Promise<any> {
        return this.home.getEntityState(entity);
    }

    public async getHAStatus(): Promise<any> {
        return this.home.getStatus();
    }

    public async callHAService(service: string, data?: any): Promise<void> {
        return this.home.executeCommand(service, data);
    }

    public async updateAIContext(key: string, value: any): Promise<void> {
        return this.ai.updateContext(key, value);
    }

    public async initialize(): Promise<void> {
        try {
            logger.info('Initializing services...');

            // Initialize services in correct order
            await this.initializeServices();
            
            // Verify all services are healthy
            await this.verifyServicesHealth();
            
            this.state.isInitialized = true;
            logger.info('Services initialized successfully');
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            this.state.lastError = err;
            logger.error('Failed to initialize services:', err);
            throw err;
        }
    }

    private async initializeServices(): Promise<void> {
        // Initialize hardware first
        await this.hardwareService.initialize();
        this.state.activeServices.push('hardware');

        // Initialize Home Assistant
        await this.homeAssistant.initialize();
        this.state.activeServices.push('homeAssistant');

        // Initialize AI service
        await this.aiService.initialize();
        this.state.activeServices.push('ai');

        // Initialize supporting services
        await Promise.all([
            this.musicService.initialize(),
            this.timerService.start()
        ]);
        
        this.state.activeServices.push('music', 'timer');
    }

    private async verifyServicesHealth(): Promise<void> {
        const healthChecks = [
            this.hardwareService.isHealthy(),
            this.homeAssistant.getStatus().isConnected,
            this.aiService !== undefined,
            this.musicService !== undefined,
            this.timerService !== undefined
        ];

        if (!healthChecks.every(check => check)) {
            throw new Error('One or more services failed health check');
        }
    }

    public async handleCommand(command: string, data?: Buffer): Promise<void> {
        if (!this.state.isInitialized) {
            throw new Error('Services not initialized');
        }

        try {
            logger.debug('Processing command', { command, hasData: !!data });
            
            // Detect intent from command
            const intentMatch = await this.intentHandler.detectIntent(command);
            
            if (!intentMatch) {
                logger.debug('No intent match found, handling as general query');
                await this.handleGeneralQuery(command);
                return;
            }

            // Execute matched intent
            await this.executeIntent(
                intentMatch.intent.action,
                intentMatch.parameters
            );

        } catch (error) {
            logger.error('Error handling command:', error);
            throw error;
        }
    }

    private async executeIntent(
        action: IntentAction,
        parameters?: Record<string, any>
    ): Promise<void> {
        logger.info('Executing intent', { action, parameters });

        try {
            switch (action) {
                case 'PLAY_MUSIC':
                    await this.musicService.play(parameters?.query || '');
                    break;

                case 'TOGGLE_LIGHTS':
                    await this.homeAssistant.executeCommand(
                        'light.toggle',
                        parameters
                    );
                    break;

                case 'SET_TIMER':
                    if (!parameters?.duration) {
                        throw new Error('Timer duration required');
                    }
                    await this.timerService.setTimer(parameters.duration);
                    break;

                default:
                    await this.handleGeneralQuery(parameters?.query || '');
            }
        } catch (error) {
            logger.error('Error executing intent:', error);
            throw error;
        }
    }

    private async handleGeneralQuery(query: string): Promise<void> {
        try {
            const response = await this.aiService.processText(query);
            const audio = await this.aiService.generateSpeech(response);
            this.emit('response', audio);
        } catch (error) {
            logger.error('Error processing general query:', error);
            throw error;
        }
    }

    private async handleStateChange(event: { 
        entityId: string;
        state: any;
    }): Promise<void> {
        logger.debug('Processing state change', { event });

        try {
            // Generate voice response for important state changes
            const response = await this.aiService.processText(
                `The ${event.entityId} is now ${event.state.state}`
            );
            const audio = await this.aiService.generateSpeech(response);
            
            // Play response through phone
            await this.phoneController.playAudio(audio);
        } catch (error) {
            logger.error('Error handling state change:', error);
        }
    }

    private async handleTimerComplete(timerId: string): Promise<void> {
        try {
            const response = await this.aiService.processText(
                "Your timer has completed."
            );
            const audio = await this.aiService.generateSpeech(response);
            await this.phoneController.playAudio(audio);
        } catch (error) {
            logger.error('Error handling timer completion:', error);
        }
    }

    private async handleHardwareError(error: Error): Promise<void> {
        logger.error('Hardware error:', error);
        
        try {
            // Attempt recovery
            await this.hardwareService.initialize();
            
            // Notify user of recovery
            const response = await this.aiService.processText(
                "I've recovered from a temporary hardware issue. Everything should be working now."
            );
            const audio = await this.aiService.generateSpeech(response);
            await this.phoneController.playAudio(audio);
        } catch (recoveryError) {
            logger.error('Recovery failed:', recoveryError);
            throw recoveryError;
        }
    }

    // Service accessors
    public getAIService(): IrohAIService {
        return this.aiService;
    }

    public getHomeAssistant(): HAService {
        return this.homeAssistant;
    }

    public getMusicService(): MusicService {
        return this.musicService;
    }

    public getTimerService(): TimerService {
        return this.timerService;
    }

    public getHardwareService(): HardwareService {
        return this.hardwareService;
    }

    public getState(): ServiceState {
        return { ...this.state };
    }

    public async shutdown(): Promise<void> {
        logger.info('Shutting down services...');

        try {
            // Shutdown services in reverse order
            await Promise.all([
                this.timerService.stop(),
                this.musicService.shutdown(),
                this.aiService.shutdown(),
                this.homeAssistant.shutdown(),
                this.hardwareService.shutdown()
            ]);

            this.state.isInitialized = false;
            this.state.activeServices = [];
            
            logger.info('Services shutdown complete');
        } catch (error) {
            logger.error('Error during service shutdown:', error);
            throw error;
        }
    }
}