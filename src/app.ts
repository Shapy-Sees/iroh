// File: src/app.ts
//
// Description:
// Main application entry point for Project Iroh.
// Initializes all core services and handles application lifecycle.

import { PhoneController } from './controllers/phone-controller';
import { ServiceManager } from './services/service-manager';
import { PhoneControllerConfig } from './types';
import { config } from './config';
import { logger } from './utils/logger';

// Remove local interface definition and use the imported one

export class IrohApp {
    private phoneController!: PhoneController; // Using definite assignment assertion
    private serviceManager: ServiceManager;

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
            ai: config.ai // Add ai configuration
        };
        
        this.phoneController = new PhoneController(phoneConfig);
    }

    public async start(): Promise<void> {
        try {
            logger.info('Starting Iroh application...');
            
            // Initialize services
            await this.serviceManager.initialize();
            
            // Start phone controller
            await this.phoneController.start();

            // Set up event handlers
            this.setupEventHandlers();
            
            logger.info('Iroh application started successfully');
        } catch (error) {
            logger.error('Failed to start application:', error as Error);
            throw error;
        }
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
    }

    private async handleDTMFCommand(digit: string): Promise<void> {
        // Handle DTMF commands
        await this.serviceManager.handleCommand(digit);
    }

    // Update handleVoiceCommand to use public methods
    private async handleVoiceCommand(audioBuffer: Buffer): Promise<void> {
        try {
            await this.serviceManager.handleCommand('voice', audioBuffer);
            
            this.serviceManager.once('response', async (audioResponse: Buffer) => {
                try {
                    // Use playTone instead of playFeedbackTone
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


    public async shutdown(): Promise<void> {
        try {
            logger.info('Shutting down Iroh application...');
            
            await this.phoneController.stop();
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

/*
// src/app.ts
//
// Key Features:
// - Main application setup
// - Service coordination
// - Phone controller integration
// - Error handling
// - Graceful shutdown
// - State management

import { ServiceManager } from './services/service-manager';
import { PhoneController } from './controllers/phone-controller';
import { Config } from './types';
import { logger } from './utils/logger';
import { config } from './config';

export class IrohApp {
    private services: ServiceManager;
    private phoneController: PhoneController | undefined;
    private isRunning: boolean = false;

    constructor() {
        this.services = new ServiceManager(config);
    }

    public async start(): Promise<void> {
        try {
            logger.info('Starting Iroh application...');

            // Initialize services
            await this.services.initialize();

            // Initialize phone controller
            this.phoneController = new PhoneController({
                fxs: config.audio,
                ai: config.ai
            });

            // Set up phone event handlers
            this.setupPhoneHandlers();

            // Start phone controller
            await this.phoneController.start();

            this.isRunning = true;
            logger.info('Iroh application started successfully');

            // Set up graceful shutdown
            this.setupShutdown();

        } catch (error) {
            logger.error('Failed to start application:', error as Error);
            await this.shutdown();
            throw error;
        }
    }

    private setupPhoneHandlers(): void {
        // Handle DTMF commands
        this.phoneController!.on('command', async (sequence) => {
            try {
                await this.services.handleCommand(sequence);
            } catch (error) {
                logger.error('Error handling DTMF command:', error as Error);
            }
        });

        // Handle voice input
        this.phoneController!.on('voice', async (event) => {
            try {
                await this.services.handleCommand('', event.audio);
            } catch (error) {
                logger.error('Error handling voice command:', error as Error);
            }
        });

        // Handle service responses
        this.services.on('response', async (audioBuffer: Buffer) => {
            try {
                await this.phoneController!.playAudio(audioBuffer);
            } catch (error) {
                logger.error('Error playing response:', error as Error);
            }
        });
    }

    private setupShutdown(): void {
        // Handle process signals
        process.on('SIGTERM', () => this.shutdown());
        process.on('SIGINT', () => this.shutdown());
        
        // Handle uncaught errors
        process.on('uncaughtException', (error) => {
            logger.error('Uncaught exception:', error);
            this.shutdown();
        });
    }

    public async shutdown(): Promise<void> {
        if (!this.isRunning) return;

        logger.info('Shutting down Iroh application...');
        
        try {
            // Shutdown phone controller
            await this.phoneController!.stop();

            // Shutdown services
            await this.services.shutdown();

            this.isRunning = false;
            logger.info('Iroh application shut down successfully');
            
        } catch (error) {
            logger.error('Error during shutdown:', error as Error);
            process.exit(1);
        }
    }
}

// Application entry point
if (require.main === module) {
    const app = new IrohApp();
    app.start().catch((error) => {
        logger.error('Application startup failed:', error);
        process.exit(1);
    });
}
*/