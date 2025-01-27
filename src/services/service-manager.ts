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

import { EventEmitter } from 'node:events';
import { 
    Service,
    ServiceRegistry,
    ServiceName,
    ServiceState,
    ServiceStatus,
    ServiceError 
} from '../types/services';
import { IrohAIService } from './ai/ai-service';
import { HAService } from './home/ha_service';
import { MusicService } from './music/music-service';
import { TimerService } from './timer/timer-service';
import { HardwareService } from './hardware/hardware-service';
import { IntentHandler } from './intent/intent-handler';
import { Config, ServiceError } from '../types/core';
import type { AudioBuffer } from '../types/hardware/audio';
import type { HAEvent } from '../types/service/home';
import { logger } from '../utils/logger';
import { PhoneController } from '../controllers/phone-controller';
import { errorHandler } from '../utils/error-handler';
import { Config, AIConfig, HAConfig } from '../types';
import { DAHDIConfig } from '../types/hardware/dahdi';

interface ServiceManagerState {
    isInitialized: boolean;
    activeServices: Set<ServiceName>;
    serviceStates: Map<ServiceName, ServiceState>;
    startTime?: number;
    lastError?: ServiceError;
}

export interface ServiceManager {
    getHAEntityStatus(entity: string): Promise<any>;
    getHAStatus(): Promise<any>;
    callHAService(service: string, data?: any): Promise<void>;
}

export class ServiceManager extends EventEmitter {
    private readonly services: Map<ServiceName, Service>;
    private state: ServiceManagerState;
    private readonly config: Config;
    private readonly phoneController: PhoneController;
    private initPromise: Promise<void> | null = null;

    // Core service instances
    private aiService!: IrohAIService;
    private homeAssistant!: HAService;
    private musicService!: MusicService;
    private timerService!: TimerService;
    private hardwareService!: HardwareService;
    private intentHandler!: IntentHandler;

    constructor(config: Config, phoneController: PhoneController) {
        super();
        
        this.config = config;
        this.phoneController = phoneController;
        this.services = new Map();
        
        this.state = {
            isInitialized: false,
            activeServices: new Set(),
            serviceStates: new Map(),
        };

        this.createServiceInstances();
        this.setupEventHandlers();

        logger.info('Service manager constructed', {
            configuredServices: Array.from(this.services.keys())
        });
    }

    private createServiceInstances(): void {
        // Create services with type safety
        this.createService('hardware', () => new HardwareService(this.getDahdiConfig()));
        this.createService('ai', () => new IrohAIService(this.getAIConfig()));
        this.createService('home', () => new HAService(this.config.home));
        this.createService('music', () => new MusicService(this.config.music));
        this.createService('timer', () => new TimerService(
            { maxTimers: 5, maxDuration: 180 },
            this.phoneController,
            this.getService('ai')
        ));
    }

    private createService<T extends ServiceName>(
        name: T,
        factory: () => ServiceRegistry[T]
    ): void {
        const service = factory();
        this.services.set(name, service);
        this.state.serviceStates.set(name, 'initializing');
    }

    public getService<T extends ServiceName>(name: T): ServiceRegistry[T] {
        const service = this.services.get(name);
        if (!service) {
            throw new Error(`Service ${name} not found`);
        }
        return service as ServiceRegistry[T];
    }

    private setupEventHandlers(): void {
        // Type the event handlers properly
        this.homeAssistant.addListener('state_changed', async (event: HAEvent) => {
            try {
                await this.handleStateChange(event);
            } catch (error) {
                errorHandler.handleError(error, {
                    component: 'ServiceManager',
                    operation: 'handleStateChange'
                });
            }
        });

        this.timerService.addListener('timerComplete', async (timerId: string) => {
            try {
                await this.handleTimerComplete(timerId);
            } catch (error) {
                errorHandler.handleError(error, {
                    component: 'ServiceManager', 
                    operation: 'handleTimerComplete'
                });
            }
        });

        // Handle hardware events
        this.hardwareService.on('hardware_error', async (error: Error) => {
            try {
                await this.handleHardwareError(error);
            } catch (error) {
                errorHandler.handleError(error, {
                    component: 'ServiceManager',
                    operation: 'handleHardwareError'
                });
            }
        });

        // Handle intent detection results
        this.intentHandler.on('contextUpdate', (context: any) => {
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
                activeServices: Array.from(this.state.activeServices),
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
        const initOrder: ServiceName[] = ['hardware', 'ai', 'home', 'music', 'timer'];

        for (const serviceName of initOrder) {
            try {
                const service = this.getService(serviceName);
                await service.initialize();
                
                this.state.activeServices.add(serviceName);
                this.state.serviceStates.set(serviceName, 'ready');
                
                logger.info(`Initialized ${serviceName} service`);
            } catch (error) {
                this.state.serviceStates.set(serviceName, 'error');
                throw this.createServiceError(serviceName, error);
            }
        }
    }

    private createServiceError(serviceName: ServiceName, error: unknown): ServiceError {
        const serviceError: ServiceError = {
            name: 'ServiceError',
            message: error instanceof Error ? error.message : String(error),
            serviceName,
            severity: 'high',
            timestamp: new Date(),
            stack: error instanceof Error ? error.stack : undefined
        };
        return serviceError;
    }

    private async verifyServicesHealth(): Promise<void> {
        const unhealthyServices: Array<string> = [];

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

    public async handleCommand(command: string, data?: AudioBuffer): Promise<void> {
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

            // Execute matched intent with required parameters
            if (intentMatch.parameters) {
                await this.executeIntent(intentMatch.intent.action, intentMatch.parameters);
            } else {
                throw new ServiceError('Missing required parameters for intent');
            }

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

    public async getServiceStatuses(): Promise<Record<ServiceName, ServiceStatus>> {
        const statuses: Partial<Record<ServiceName, ServiceStatus>> = {};
        
        for (const [name, service] of this.services.entries()) {
            statuses[name] = service.getStatus();
        }
        
        return statuses as Record<ServiceName, ServiceStatus>;
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

    public getState(): ServiceManagerState {
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
        
        this.state.activeServices.clear();
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

    private async executeIntent(action: string, parameters: Record<string, any>): Promise<void> {
        try {
            // Execute the intent action with parameters
            switch (action) {
                case 'music.play':
                    await this.musicService.play(parameters.track);
                    break;
                case 'home.control':
                    await this.homeAssistant.controlDevice(parameters.device, parameters.command);
                    break;
                case 'timer.set':
                    await this.timerService.createTimer(parameters.duration);
                    break;
                default:
                    throw new ServiceError(`Unknown intent action: ${action}`);
            }
        } catch (error) {
            logger.error('Error executing intent:', error);
            throw error;
        }
    }

    emit<K extends keyof ServiceManagerEvents>(
        event: K, 
        ...args: Parameters<ServiceManagerEvents[K]>
    ): boolean {
        return super.emit(event, ...args);
    }

    on<K extends keyof ServiceManagerEvents>(
        event: K, 
        listener: ServiceManagerEvents[K]
    ): this {
        return super.on(event, listener);
    }

    private async handleError(error: Error, context: string): Promise<void> {
        logger.error(`Service error in ${context}:`, error);
        this.emit('error', error);
    }

    private async validateConfig(): Promise<void> {
        if (!this.config) {
            logger.error('No configuration provided');
            throw new ConfigurationError('No configuration provided');
        }
        // ... rest of validation
    }

    private getDahdiConfig(): DAHDIConfig {
        return {
            devicePath: this.config.hardware.dahdi.devicePath,
            controlPath: this.config.hardware.dahdi.controlPath,
            sampleRate: 8000,
            channels: 1,
            bitDepth: 16,
            bufferSize: this.config.audio.bufferSize,
            channel: this.config.hardware.dahdi.channel
        };
    }

    private getAIConfig(): AIServiceConfig {
        return {
            anthropicKey: this.config.ai.anthropicKey,
            elevenLabsKey: this.config.ai.elevenLabsKey,
            maxTokens: this.config.ai.maxTokens,
            temperature: this.config.ai.temperature,
            model: this.config.ai.model
        };
    }
}