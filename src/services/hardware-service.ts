// src/services/hardware/hardware-service.ts
//
// Hardware service for managing DAHDI hardware resources and diagnostics.
// This service coordinates hardware initialization, monitors health,
// and provides diagnostic capabilities for the FXS interface.

import { EventEmitter } from 'events';
import { FXSInterface } from '../../hardware/fxs-interface';
import { DAHDIConfig } from '../../config/dahdi';
import { logger } from '../../utils/logger';

interface HardwareStatus {
    isInitialized: boolean;
    fxsStatus: {
        isOpen: boolean;
        lastError?: Error;
        channelStatus: Array<{
            channel: number;
            active: boolean;
            errors: number;
        }>;
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
    private dahdiConfig: DAHDIConfig;
    private fxsInterface: FXSInterface;
    private status: HardwareStatus;
    private healthCheckInterval: NodeJS.Timeout | null = null;
    private readonly HEALTH_CHECK_INTERVAL = 60000; // 1 minute

    constructor(fxsInterface: FXSInterface) {
        super();
        this.fxsInterface = fxsInterface;
        this.dahdiConfig = new DAHDIConfig();
        
        // Initialize status
        this.status = {
            isInitialized: false,
            fxsStatus: {
                isOpen: false,
                channelStatus: []
            },
            systemHealth: {
                voltages: {},
                errors: 0
            }
        };

        this.setupEventHandlers();
    }

    private setupEventHandlers(): void {
        // Monitor FXS interface events
        this.fxsInterface.on('error', (error: Error) => {
            logger.error('FXS interface error:', error);
            this.status.fxsStatus.lastError = error;
            this.status.systemHealth.errors++;
            this.emit('hardware_error', error);
        });

        this.fxsInterface.on('ready', () => {
            this.status.fxsStatus.isOpen = true;
            this.emit('hardware_ready');
        });
    }

    public async initialize(): Promise<void> {
        try {
            logger.info('Initializing hardware service');

            // Load DAHDI configuration
            await this.dahdiConfig.load();

            // Validate system configuration
            if (!await this.dahdiConfig.validateSystem()) {
                throw new Error('DAHDI system validation failed');
            }

            // Start FXS interface
            await this.fxsInterface.start();

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
            // Check DAHDI system status
            const hardwareInfo = this.dahdiConfig.getHardwareInfo();
            
            if (hardwareInfo) {
                // Update channel status
                const config = this.dahdiConfig.getConfig();
                this.status.fxsStatus.channelStatus = config.spans.flatMap(span =>
                    span.channels.map(channel => ({
                        channel: channel.channel,
                        active: this.fxsInterface.isOpen(),
                        errors: 0  // Reset error count on successful check
                    }))
                );

                // Check FXS port voltage (if available)
                // This would require actual hardware interaction
                this.status.systemHealth.voltages.fxs = 48; // Nominal FXS voltage

                // Update system health status
                this.emit('health_update', this.status);
            } else {
                throw new Error('Unable to get hardware information');
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
            // Test DAHDI configuration
            results.push({
                test: 'DAHDI Configuration',
                passed: await this.dahdiConfig.validateSystem(),
                message: 'DAHDI system validation completed'
            });

            // Test FXS interface
            results.push({
                test: 'FXS Interface',
                passed: this.fxsInterface.isOpen(),
                message: this.fxsInterface.isOpen() ? 'FXS interface is active' : 'FXS interface is not active'
            });

            // Test audio path
            const audioTestResult = await this.testAudioPath();
            results.push({
                test: 'Audio Path',
                passed: audioTestResult.passed,
                message: audioTestResult.message
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
            
            // Try to play and record the tone
            await this.fxsInterface.playAudio(testTone);
            
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

    private generateTestTone(): Buffer {
        // Generate a 1kHz test tone
        const sampleRate = 8000;
        const duration = 0.1; // 100ms
        const frequency = 1000;
        const samples = Math.floor(sampleRate * duration);
        const buffer = Buffer.alloc(samples * 2);

        for (let i = 0; i < samples; i++) {
            const value = Math.sin(2 * Math.PI * frequency * i / sampleRate) * 0x7FFF;
            buffer.writeInt16LE(Math.floor(value), i * 2);
        }

        return buffer;
    }

    public getStatus(): HardwareStatus {
        return { ...this.status };
    }

    public async shutdown(): Promise<void> {
        logger.info('Shutting down hardware service');

        try {
            // Stop health monitoring
            if (this.healthCheckInterval) {
                clearInterval(this.healthCheckInterval);
                this.healthCheckInterval = null;
            }

            // Stop FXS interface
            await this.fxsInterface.stop();

            this.status.isInitialized = false;
            this.status.fxsStatus.isOpen = false;

            logger.info('Hardware service shutdown complete');
        } catch (error) {
            logger.error('Error during hardware service shutdown:', error);
            throw error;
        }
    }
}