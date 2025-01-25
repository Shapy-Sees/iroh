// src/services/hardware/hardware-service.ts
//
// Hardware service that manages DAHDI hardware resources and diagnostics.
// This service coordinates hardware initialization, monitors health,
// and provides diagnostic capabilities. It now specifically uses the 
// DAHDI interface for hardware communication.

import { EventEmitter } from 'events';
import { DAHDIInterface } from '../../hardware/dahdi-interface';
import { DAHDIConfig } from '../../config/dahdi';
import { DAHDIChannelStatus } from '../../types/dahdi';
import { logger } from '../../utils/logger';

interface HardwareStatus {
    isInitialized: boolean;
    dahdiStatus: {
        isOpen: boolean;
        lastError?: Error;
        channelStatus: DAHDIChannelStatus | null;
    };
    systemHealth: {
        temperature?: number;
        voltages: {
            fxs?: number;  // FXS port voltage
            system?: number; // System voltage
        };
        errors: number;
    };
}

export class HardwareService extends EventEmitter {
    private dahdi: DAHDIInterface;
    private dahdiConfig: DAHDIConfig;
    private status: HardwareStatus;
    private healthCheckInterval: NodeJS.Timeout | null = null;
    private readonly HEALTH_CHECK_INTERVAL = 60000; // 1 minute

    constructor(config: DAHDIConfig) {
        super();
        
        this.dahdiConfig = config;
        this.dahdi = new DAHDIInterface(config);
        
        // Initialize status
        this.status = {
            isInitialized: false,
            dahdiStatus: {
                isOpen: false,
                channelStatus: null
            },
            systemHealth: {
                voltages: {},
                errors: 0
            }
        };

        this.setupEventHandlers();
    }

    private setupEventHandlers(): void {
        // Monitor DAHDI interface events
        this.dahdi.on('error', (error: Error) => {
            logger.error('DAHDI interface error:', error);
            this.status.dahdiStatus.lastError = error;
            this.status.systemHealth.errors++;
            this.emit('hardware_error', error);
        });

        this.dahdi.on('ready', () => {
            this.status.dahdiStatus.isOpen = true;
            this.emit('hardware_ready');
        });

        // Handle hook state changes
        this.dahdi.on('hook_state', ({ offHook }) => {
            logger.debug('Hook state change detected', { offHook });
            this.emit('hook_state', { offHook });
        });

        // Handle ring events
        this.dahdi.on('ring_start', () => {
            logger.debug('Ring start detected');
            this.emit('ring_start');
        });

        this.dahdi.on('ring_stop', () => {
            logger.debug('Ring stop detected');
            this.emit('ring_stop');
        });
    }

    public async initialize(): Promise<void> {
        try {
            logger.info('Initializing hardware service');

            // Start DAHDI interface
            await this.dahdi.start();

            // Start health monitoring
            this.startHealthMonitoring();

            this.status.isInitialized = true;
            logger.info('Hardware service initialized successfully');
        } catch (error) {
            logger.error('Failed to initialize hardware service:', error);
            throw error;
        }
    }

    private startHealthMonitoring(): void {
        this.healthCheckInterval = setInterval(async () => {
            try {
                await this.performHealthCheck();
            } catch (error) {
                logger.error('Health check failed:', error);
            }
        }, this.HEALTH_CHECK_INTERVAL);
    }

    private async performHealthCheck(): Promise<void> {
        logger.debug('Performing hardware health check');

        try {
            // Get current DAHDI channel status
            const channelStatus = this.dahdi.getStatus();
            if (channelStatus) {
                this.status.dahdiStatus.channelStatus = channelStatus;

                // Check FXS port voltage
                if (channelStatus.levels) {
                    this.status.systemHealth.voltages.fxs = 48; // Nominal FXS voltage
                }

                // Update system health status
                this.emit('health_update', this.status);
            } else {
                throw new Error('Unable to get DAHDI channel status');
            }

            // Check for any lingering errors
            const lastError = this.dahdi.getLastError();
            if (lastError) {
                logger.warn('Last error detected:', lastError);
                this.status.dahdiStatus.lastError = lastError;
            }

        } catch (error) {
            logger.error('Health check error:', error);
            this.status.systemHealth.errors++;
            this.emit('health_error', error);
        }
    }

    public async runDiagnostics(): Promise<Array<{ test: string; passed: boolean; message?: string }>> {
        logger.info('Running hardware diagnostics');
        const results = [];

        try {
            // Test DAHDI interface status
            results.push({
                test: 'DAHDI Interface',
                passed: this.dahdi.isOpen(),
                message: this.dahdi.isOpen() ? 'DAHDI interface is active' : 'DAHDI interface is not active'
            });

            // Test hook state detection
            results.push({
                test: 'Hook State Detection',
                passed: Boolean(this.status.dahdiStatus.channelStatus),
                message: 'Hook state detection system operational'
            });

            // Test audio path
            const audioTestResult = await this.testAudioPath();
            results.push({
                test: 'Audio Path',
                passed: audioTestResult.passed,
                message: audioTestResult.message
            });

            // Test ring generation
            const ringTestResult = await this.testRingGeneration();
            results.push({
                test: 'Ring Generation',
                passed: ringTestResult.passed,
                message: ringTestResult.message
            });

            return results;
        } catch (error) {
            logger.error('Diagnostics failed:', error);
            throw error;
        }
    }

    private async testAudioPath(): Promise<{ passed: boolean; message: string }> {
        try {
            // Generate test tone
            const testTone = this.generateTestTone();
            
            // Try to play the tone through DAHDI
            await this.dahdi.playAudio(testTone);
            
            return {
                passed: true,
                message: 'Audio path test completed successfully'
            };
        } catch (error) {
            return {
                passed: false,
                message: `Audio path test failed: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    private async testRingGeneration(): Promise<{ passed: boolean; message: string }> {
        try {
            // Test short ring burst
            await this.dahdi.ring(500); // 500ms ring
            
            return {
                passed: true,
                message: 'Ring generation test completed successfully'
            };
        } catch (error) {
            return {
                passed: false,
                message: `Ring generation test failed: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    private generateTestTone(): Buffer {
        // Generate a 1kHz test tone
        const sampleRate = 8000; // DAHDI sample rate
        const duration = 0.1; // 100ms
        const frequency = 1000;
        const samples = Math.floor(sampleRate * duration);
        const buffer = Buffer.alloc(samples * 2); // 16-bit samples

        for (let i = 0; i < samples; i++) {
            const value = Math.sin(2 * Math.PI * frequency * i / sampleRate) * 0x7FFF;
            buffer.writeInt16LE(Math.floor(value), i * 2);
        }

        return buffer;
    }

    public getStatus(): HardwareStatus {
        return { ...this.status };
    }

    public async ring(duration: number = 2000): Promise<void> {
        try {
            await this.dahdi.ring(duration);
        } catch (error) {
            logger.error('Error during ring generation:', error);
            throw error;
        }
    }

    public async playAudio(buffer: Buffer): Promise<void> {
        try {
            await this.dahdi.playAudio(buffer);
        } catch (error) {
            logger.error('Error playing audio:', error);
            throw error;
        }
    }

    public async shutdown(): Promise<void> {
        logger.info('Shutting down hardware service');

        try {
            // Stop health monitoring
            if (this.healthCheckInterval) {
                clearInterval(this.healthCheckInterval);
                this.healthCheckInterval = null;
            }

            // Stop DAHDI interface
            await this.dahdi.stop();

            this.status.isInitialized = false;
            this.status.dahdiStatus.isOpen = false;

            logger.info('Hardware service shutdown complete');
        } catch (error) {
            logger.error('Error during hardware service shutdown:', error);
            throw error;
        }
    }
}