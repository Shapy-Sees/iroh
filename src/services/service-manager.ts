// src/services/service-manager.ts
//
// Service manager that coordinates all core services including:
// - AI processing (Claude and ElevenLabs)
// - Home Assistant integration 
// - Music playback
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
import { IntentHandler } from './intent/intent-handler';
import { Config, ServiceError, ServiceStatus } from '../types';
import { logger } from '../utils/logger';
import { PhoneController } from '../controllers/phone-controller';

interface ServiceState {
    isInitialized: boolean;
    activeServices: string[];
    lastError?: Error;
    startTime?: number;
}

export class ServiceManager extends EventEmitter {
    private readonly services: Map<string, any>;
    private state: ServiceState;
    private readonly config: Config;
    private readonly phoneController: PhoneController;
    private initPromise: Promise<void> | null = null;

    // Core service instances
    private aiService: IrohAIService;
    private homeAssistant: HAService;
    private musicService: MusicService;
    private timerService: TimerService;
    private hardwareService: HardwareService;
    private intentHandler: IntentHandler;

    constructor(config: Config, phoneController: PhoneController) {
        super();
        
        this.config = config;
        this.phoneController = phoneController;
        this.services = new Map();
        
        // Initialize state
        this.state = {
            isInitialized: false,
            activeServices: [],
        };

        // Create service instances
        this.createServiceInstances();
        
        // Set up core event handlers
        this.setupEventHandlers();

        logger.info('Service manager constructed', {
            configuredServices: Object.keys(config)
        });
    }

    private createServiceInstances(): void {
        // Create core services in dependency order
        this.hardwareService = new HardwareService(this.phoneController.getFXSInterface());
        this.services.set('hardware', this.hardwareService);

        this.aiService = new IrohAIService(this.config.ai);
        this.services.set('ai', this.aiService);

        this.homeAssistant = new HAService(this.config.home);
        this.services.set('home', this.homeAssistant);

        this.musicService = new MusicService(this.config.music);
        this.services.set('music', this.musicService);

        this.timerService = new TimerService(
            { maxTimers: 5, maxDuration: 180 },
            this.phoneController,
            this.aiService
        );
        this.services.set('timer', this.timerService);

        this.intentHandler = new IntentHandler();
        this.services.set('intent', this.intentHandler);
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

        // Handle timer events
        this.timerService.on('timerComplete', async (timerId: string) => {
            try {
                await this.handleTimerComplete(timerId);
            } catch (error) {
                logger.error('Error handling timer completion:', error);
            }
        });

        // Handle hardware events
        this.hardwareService.on('hardware_error', async (error: Error) => {
            logger.error('Hardware error detected:', error);
            await this.handleHardwareError(error);
        });

        // Handle intent detection results
        this.intentHandler.on('contextUpdate', (context) => {
            logger.debug('Intent context updated', { context });
        });
    }

    public async initialize(): Promise<void> {
        // Prevent multiple simultaneous initializations
        if (this.initPromise) {
            return this.initPromise;
        }

        this.initPromise = this.performInitialization();
        return this.initPromise;
    }

    private async performInitialization(): Promise<void> {
        try {
            logger.info('Initializing services...');
            this.state.startTime = Date.now();

            // Initialize services in correct order with proper error handling
            await this.initializeServices();
            
            // Verify all services are healthy
            await this.verifyServicesHealth();
            
            this.state.isInitialized = true;
            
            // Emit initialization complete event
            this.emit('initialized');
            
            logger.info('Services initialized successfully', {
                activeServices: this.state.activeServices,
                initTime: Date.now() - this.state.startTime
            });

        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            this.state.lastError = err;
            logger.error('Failed to initialize services:', err);
            throw new ServiceError(`Service initialization failed: ${err.message}`);
        } finally {
            this.initPromise = null;
        }
    }

    private async initializeServices(): Promise<void> {
        try {
            // 1. Initialize hardware first
            logger.info('Initializing hardware service...');
            await this.hardwareService.initialize();
            this.state.activeServices.push('hardware');

            // 2. Initialize remaining services in parallel
            logger.info('Initializing core services...');
            await Promise.all([
                this.initializeService('ai', this.aiService),
                this.initializeService('home', this.homeAssistant),
                this.initializeService('music', this.musicService),
                this.initializeService('timer', this.timerService)
            ]);

            logger.info('All services initialized successfully');

        } catch (error) {
            logger.error('Service initialization failed:', error);
            await this.stopServices();
            throw error;
        }
    }

    private async initializeService(name: string, service: any): Promise<void> {
        try {
            await service.initialize();
            this.state.activeServices.push(name);
            logger.info(`${name} service initialized`);
        } catch (error) {
            logger.error(`Failed to initialize ${name} service:`, error);
            throw error;
        }
    }

    private async verifyServicesHealth(): Promise<void> {
        const unhealthyServices = [];

        for (const [name, service] of this.services) {
            if (typeof service.isHealthy === 'function' && !service.isHealthy()) {
                unhealthyServices.push(name);
            }
        }

        if (unhealthyServices.length > 0) {
            throw new ServiceError(
                `Unhealthy services detected: ${unhealthyServices.join(', ')}`
            );
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

    public async handleCommand(command: string, data?: Buffer): Promise<void> {
        if (!this.state.isInitialized) {
            throw new ServiceError('Services not initialized');
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
            await this.executeIntent(intentMatch.intent.action, intentMatch.parameters);

        } catch (error) {
            logger.error('Error handling command:', error);
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

    public getServiceStatus(serviceName: string): ServiceStatus | null {
        const service = this.services.get(serviceName);
        if (!service || typeof service.getStatus !== 'function') {
            return null;
        }
        return service.getStatus();
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

    private async stopServices(): Promise<void> {
        logger.info('Stopping services...');
        
        // Stop in reverse order of initialization
        for (const serviceName of [...this.state.activeServices].reverse()) {
            const service = this.services.get(serviceName);
            if (service && typeof service.shutdown === 'function') {
                try {
                    await service.shutdown();
                    logger.debug(`${serviceName} service stopped`);
                } catch (error) {
                    logger.error(`Error stopping ${serviceName} service:`, error);
                }
            }
        }
        
        this.state.activeServices = [];
    }

    public async shutdown(): Promise<void> {
        logger.info('Shutting down service manager...');

        try {
            await this.stopServices();
            this.state.isInitialized = false;
            this.removeAllListeners();
            
            logger.info('Service manager shutdown complete');
        } catch (error) {
            logger.error('Error during service shutdown:', error);
            throw error;
        }
    }
}