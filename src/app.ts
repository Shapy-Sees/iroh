// src/app.ts
//
// Main application entry point for Project Iroh.
// Initializes and coordinates all core services including the new timer service.

import { PhoneController } from './controllers/phone-controller';
import { ServiceManager } from './services/service-manager';
import { TimerService } from './services/timer/timer-service';
import { PhoneControllerConfig } from './types';
import { config } from './config';
import { logger } from './utils/logger';

export class IrohApp {
    private phoneController!: PhoneController;
    private serviceManager: ServiceManager;
    private timerService!: TimerService;

    constructor() {
        this.serviceManager = new ServiceManager(config);
        
        // Create phone controller with proper config
        const phoneConfig: PhoneControllerConfig = {
            fxs: {
                devicePath: process.env.FXS_DEVICE_PATH || '/dev/ttyUSB0',
                sampleRate: config.audio.sampleRate
            },
            audio: {
                bufferSize: 320,
                channels: config.audio.channels,
                bitDepth: config.audio.bitDepth
            },
            ai: config.ai
        };
        
        this.phoneController = new PhoneController(phoneConfig);
    }

    public async start(): Promise<void> {
        try {
            logger.info('Starting Iroh application...');
            
            // Initialize services
            await this.serviceManager.initialize();
            
            // Initialize timer service after other services
            this.initializeTimerService();
            
            // Start phone controller
            await this.phoneController.start();

            // Start timer service
            await this.timerService.start();

            // Set up event handlers
            this.setupEventHandlers();
            
            logger.info('Iroh application started successfully');
        } catch (error) {
            logger.error('Failed to start application:', error as Error);
            throw error;
        }
    }

    private initializeTimerService(): void {
        const timerConfig = {
            devicePath: process.env.TIMER_DEVICE_PATH || '/dev/ttyUSB1',
            baudRate: 9600,
            maxTimers: 5,
            maxDuration: 180 // 3 hours in minutes
        };

        this.timerService = new TimerService(
            timerConfig,
            this.phoneController,
            this.serviceManager.getAIService()
        );

        // Handle timer service errors
        this.timerService.on('error', async (error: Error) => {
            logger.error('Timer service error:', error);
            await this.handleServiceError(error);
        });
    }

    private setupEventHandlers(): void {
        this.phoneController.on('dtmf', async (digit: string) => {
            try {
                await this.handleDTMFCommand(digit);
            } catch (error) {
                logger.error('Error handling DTMF command:', error as Error);
            }
        });

        this.phoneController.on('voice', async (audioBuffer: Buffer) => {
            try {
                await this.handleVoiceCommand(audioBuffer);
            } catch (error) {
                logger.error('Error handling voice command:', error as Error);
            }
        });

        // Handle timer completions
        this.timerService.on('timerComplete', async (timerId: string) => {
            logger.info('Timer completed', { timerId });
        });
    }

    private async handleDTMFCommand(digit: string): Promise<void> {
        // Handle DTMF commands
        await this.serviceManager.handleCommand(digit);
    }

    private async handleVoiceCommand(audioBuffer: Buffer): Promise<void> {
        try {
            await this.serviceManager.handleCommand('voice', audioBuffer);
            
            this.serviceManager.once('response', async (audioResponse: Buffer) => {
                try {
                    await this.phoneController.playTone('confirm');
                    await this.phoneController.playAudio(audioResponse);
                } catch (error) {
                    logger.error('Error playing audio response:', error as Error);
                    await this.phoneController.playTone('error');
                }
            });
        } catch (error) {
            logger.error('Error handling voice command:', error as Error);
            await this.phoneController.playTone('error');
        }
    }

    private async handleServiceError(error: Error): Promise<void> {
        try {
            const errorMessage = await this.serviceManager.getAIService()
                .generateSpeech("I apologize, but I'm having trouble with the timer system. Please try again later.");
            
            await this.phoneController.playAudio(errorMessage);
        } catch (err) {
            logger.error('Error handling service error:', err);
        }
    }

    public async shutdown(): Promise<void> {
        try {
            logger.info('Shutting down Iroh application...');
            
            // Stop timer service
            await this.timerService.stop();
            
            // Stop phone controller
            await this.phoneController.stop();
            
            // Stop service manager
            await this.serviceManager.shutdown();
            
            logger.info('Iroh application shutdown complete');
        } catch (error) {
            logger.error('Error during shutdown:', error as Error);
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
        logger.error('Fatal error:', error as Error);
        process.exit(1);
    });
}

export default IrohApp;
