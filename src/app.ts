// src/app.ts
//
// Main application entry point for Project Iroh.
// Initializes and coordinates all core services including the hardware interface,
// phone controller, and service manager. Handles startup, shutdown, and error recovery.

import { PhoneController } from './controllers/phone-controller';
import { ServiceManager } from './services/service-manager';
import { TimerService } from './services/timer/timer-service';
import { HardwareService } from './services/hardware/hardware-service';
import { Config, PhoneControllerConfig, AIConfig } from './types';
import { config } from './config';
import { logger } from './utils/logger';

export class IrohApp {
    private phoneController!: PhoneController;
    private serviceManager!: ServiceManager;
    private timerService!: TimerService;
    private hardwareService!: HardwareService;

    constructor() {
        // Create phone controller config with proper types
        const phoneConfig: PhoneControllerConfig = {
            fxs: {
                devicePath: process.env.DAHDI_DEVICE_PATH || '/dev/dahdi/channel001',
                sampleRate: 8000
            },
            audio: {
                bufferSize: 320,
                channels: 1,
                bitDepth: 16
            },
            ai: {
                model: 'claude-3-opus-20240229',
                apiKey: config.ai.anthropicKey
            }
        };

        // Create complete config for service manager
        const serviceConfig: Config = {
            app: config.app,
            audio: config.audio,
            ai: {
                anthropicKey: config.ai.anthropicKey,
                elevenLabsKey: config.ai.elevenLabsKey,
                openAIKey: config.ai.openAIKey,
                maxTokens: config.ai.maxTokens,
                temperature: config.ai.temperature,
                voiceId: config.ai.voiceId
            },
            music: {
                spotifyClientId: process.env.SPOTIFY_CLIENT_ID,
                spotifyClientSecret: process.env.SPOTIFY_CLIENT_SECRET
            },
            home: {
                homekitBridge: {
                    pin: process.env.HOMEKIT_PIN || '031-45-154',
                    name: 'Iroh Bridge',
                    port: 47128
                }
            },
            logging: config.logging
        };

        // Initialize services
        this.initializeServices(phoneConfig, serviceConfig);
        
        // Set up global error handlers
        this.setupErrorHandlers();
        
        logger.info('Application constructed with configuration', {
            config: this.sanitizeConfig(serviceConfig)
        });
    }

    private sanitizeConfig(config: Config): Partial<Config> {
        // Remove sensitive data for logging
        return {
            ...config,
            ai: { ...config.ai, anthropicKey: '***', elevenLabsKey: '***', openAIKey: '***' },
            music: { ...config.music, spotifyClientSecret: '***' }
        };
    }

    private initializeServices(phoneConfig: PhoneControllerConfig, serviceConfig: Config): void {
        // Initialize hardware service
        this.hardwareService = new HardwareService(phoneConfig.fxs);

        // Initialize phone controller
        this.phoneController = new PhoneController(phoneConfig);
        
        // Initialize service manager with config and phone controller
        this.serviceManager = new ServiceManager(serviceConfig, this.phoneController);

        // Initialize timer service
        this.timerService = new TimerService(
            { maxTimers: 5, maxDuration: 180 },
            this.phoneController,
            this.serviceManager.getAIService()
        );
    }

    private setupErrorHandlers(): void {
        // Handle uncaught errors
        process.on('uncaughtException', (error: Error) => {
            logger.error('Uncaught exception:', error);
            this.handleFatalError(error);
        });

        // Handle unhandled promise rejections
        process.on('unhandledRejection', (reason: unknown) => {
            const error = reason instanceof Error ? reason : new Error(String(reason));
            logger.error('Unhandled rejection:', error);
            this.handleFatalError(error);
        });

        // Handle hardware errors
        this.hardwareService.on('hardware_error', async (error: Error) => {
            logger.error('Hardware error detected:', error);
            await this.handleHardwareError(error);
        });
    }

    private async handleHardwareError(error: Error): Promise<void> {
        try {
            logger.warn('Attempting hardware recovery...');
            
            // Stop all services
            await this.stopServices();
            
            // Reinitialize hardware
            await this.hardwareService.initialize();
            
            // Restart services
            await this.startServices();
            
            logger.info('Hardware recovery successful');
        } catch (recoveryError) {
            logger.error('Hardware recovery failed:', recoveryError);
            await this.handleFatalError(recoveryError);
        }
    }

    private async handleFatalError(error: Error): Promise<void> {
        logger.error('Fatal error occurred:', error);
        try {
            await this.shutdown();
        } finally {
            process.exit(1);
        }
    }

    public getPhoneController(): PhoneController {
        return this.phoneController;
    }

    public async start(): Promise<void> {
        try {
            logger.info('Starting Iroh application...');
            
            // Start services in correct order
            await this.startServices();
            
            logger.info('Iroh application started successfully');
        } catch (error) {
            logger.error('Failed to start application:', error);
            throw error;
        }
    }

    private async startServices(): Promise<void> {
        try {
            // Initialize hardware first
            await this.hardwareService.initialize();

            // Initialize service manager
            await this.serviceManager.initialize();
            
            // Start timer service
            await this.timerService.start();
            
            // Start phone controller last
            await this.phoneController.start();
            
            logger.info('All services started successfully');
        } catch (error) {
            logger.error('Service initialization failed:', error);
            await this.stopServices();
            throw error;
        }
    }

    private async stopServices(): Promise<void> {
        logger.info('Stopping services...');
        
        // Stop in reverse order of initialization
        if (this.timerService) {
            await this.timerService.stop().catch(e => 
                logger.error('Error stopping timer service:', e)
            );
        }
        
        if (this.phoneController) {
            await this.phoneController.stop().catch(e => 
                logger.error('Error stopping phone controller:', e)
            );
        }
        
        if (this.serviceManager) {
            await this.serviceManager.shutdown().catch(e => 
                logger.error('Error stopping service manager:', e)
            );
        }
        
        if (this.hardwareService) {
            await this.hardwareService.shutdown().catch(e => 
                logger.error('Error stopping hardware service:', e)
            );
        }
    }

    public async shutdown(): Promise<void> {
        try {
            logger.info('Shutting down Iroh application...');
            
            // Stop all services
            await this.stopServices();
            
            logger.info('Iroh application shutdown complete');
        } catch (error) {
            logger.error('Error during shutdown:', error);
            throw error;
        }
    }
}

// Start application if this file is run directly
if (require.main === module) {
    const app = new IrohApp();
    
    // Handle shutdown signals
    process.on('SIGINT', async () => {
        await app.shutdown();
        process.exit(0);
    });
    
    process.on('SIGTERM', async () => {
        await app.shutdown();
        process.exit(0);
    });
    
    app.start().catch((error) => {
        logger.error('Fatal error:', error);
        process.exit(1);
    });
}

export default IrohApp;