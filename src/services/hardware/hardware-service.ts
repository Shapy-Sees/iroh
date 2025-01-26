// src/services/hardware/hardware-service.ts
//
// Hardware service that manages DAHDI hardware resources and diagnostics.
// This service coordinates hardware initialization, monitors health,
// and provides diagnostic capabilities. It specifically uses the 
// DAHDI interface for hardware communication.

import { EventEmitter } from 'events';
import { DAHDIInterface } from '../../hardware/dahdi-interface';
import { logger } from '../../utils/logger';
import {
    DAHDIConfig,
    DAHDIChannelStatus,
    DAHDIChannelConfig,
    ServiceStatus,
    Result,
    HardwareError
} from '../../types';

// Hardware Service Status interface using the new consolidated types
interface HardwareStatus extends ServiceStatus {
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
    private status: HardwareStatus;
    private healthCheckInterval: NodeJS.Timeout | null = null;
    private readonly HEALTH_CHECK_INTERVAL = 60000; // 1 minute

    constructor(config: DAHDIConfig) {
        super();
        
        this.dahdi = new DAHDIInterface(config);
        
        // Initialize status with proper typing
        this.status = {
            isInitialized: false,
            isHealthy: false,
            metrics: {
                uptime: 0,
                errors: 0,
                warnings: 0,
                lastChecked: new Date()
            },
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
        
        logger.info('Hardware service constructed', {
            config: this.sanitizeConfig(config)
        });
    }

    private sanitizeConfig(config: DAHDIConfig): Partial<DAHDIConfig> {
        return {
            ...config,
            devicePath: '***',  // Hide sensitive paths
            controlPath: '***'
        };
    }

    private setupEventHandlers(): void {
        // Monitor DAHDI interface events
        this.dahdi.on('error', (error: Error) => {
            logger.error('DAHDI interface error:', error);
            this.status.dahdiStatus.lastError = error;
            this.status.systemHealth.errors++;
            this.status.metrics.errors++;
            this.emit('hardware_error', error);
        });

        this.dahdi.on('ready', () => {
            this.status.dahdiStatus.isOpen = true;
            this.status.isHealthy = true;
            this.emit('hardware_ready');
        });

        // Add voltage monitoring
        this.dahdi.on('voltage_change', ({ type, value }) => {
            if (type === 'fxs') {
                this.status.systemHealth.voltages.fxs = value;
            } else if (type === 'system') {
                this.status.systemHealth.voltages.system = value;
            }
            this.emit('voltage_update', { type, value });
        });
    }

    public async initialize(): Promise<Result<void>> {
        try {
            logger.info('Initializing hardware service');

            // Start DAHDI interface
            await this.dahdi.start();

            // Run initial diagnostics
            const diagnostics = await this.runDiagnostics();
            if (!diagnostics.every(test => test.passed)) {
                throw new HardwareError('Hardware diagnostics failed');
            }

            // Start health monitoring
            this.startHealthMonitoring();

            this.status.isInitialized = true;
            this.status.isHealthy = true;
            logger.info('Hardware service initialized successfully');
            
            return { success: true, data: undefined };
            
        } catch (error) {
            logger.error('Failed to initialize hardware service:', error);
            return { 
                success: false, 
                error: error instanceof Error ? error : new Error(String(error))
            };
        }
    }

    public async runDiagnostics(): Promise<Array<{
        test: string;
        passed: boolean;
        message?: string;
    }>> {
        logger.info('Running hardware diagnostics');
        const results = [];

        try {
            // Test DAHDI interface status
            results.push({
                test: 'DAHDI Interface',
                passed: this.dahdi.isOpen(),
                message: this.dahdi.isOpen() ? 
                    'DAHDI interface active' : 
                    'DAHDI interface inactive'
            });

            // Test FXS voltage
            const fxsVoltage = this.status.systemHealth.voltages.fxs;
            results.push({
                test: 'FXS Voltage',
                passed: fxsVoltage !== undefined && fxsVoltage >= 45 && fxsVoltage <= 52,
                message: `FXS voltage: ${fxsVoltage}V`
            });

            // Test audio path
            const audioTest = await this.testAudioPath();
            results.push(audioTest);

            return results;
        } catch (error) {
            logger.error('Diagnostics failed:', error);
            throw error;
        }
    }

    private async testAudioPath(): Promise<{
        test: string;
        passed: boolean;
        message: string;
    }> {
        try {
            // Generate and play test tone
            const testTone = this.generateTestTone();
            await this.dahdi.playAudio(testTone);
            
            return {
                test: 'Audio Path',
                passed: true,
                message: 'Audio path test completed successfully'
            };
        } catch (error) {
            return {
                test: 'Audio Path',
                passed: false,
                message: `Audio path test failed: ${error instanceof Error ? 
                    error.message : String(error)}`
            };
        }
    }

    private generateTestTone(): Buffer {
        // Generate 1kHz test tone
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

    private async performHealthCheck(): Promise<void> {
        try {
            // Check DAHDI channel status
            const channelStatus = this.dahdi.getStatus();
            if (channelStatus) {
                this.status.dahdiStatus.channelStatus = channelStatus;
                
                // Update system health metrics
                if (channelStatus.levels) {
                    this.status.systemHealth.voltages.fxs = 48; // Nominal FXS voltage
                }
            }

            // Check for errors
            const lastError = this.dahdi.getLastError();
            if (lastError) {
                this.status.dahdiStatus.lastError = lastError;
                this.status.systemHealth.errors++;
                this.status.metrics.errors++;
            }

            // Update metrics
            this.status.metrics.lastChecked = new Date();
            this.status.metrics.uptime = process.uptime();

            // Update overall health status
            this.status.isHealthy = this.status.systemHealth.errors === 0 && 
                                  this.status.dahdiStatus.isOpen;

        } catch (error) {
            logger.error('Health check failed:', error);
            this.status.systemHealth.errors++;
            this.status.metrics.errors++;
            this.emit('health_error', error);
        }
    }

    private startHealthMonitoring(): void {
        this.healthCheckInterval = setInterval(
            () => this.performHealthCheck(),
            this.HEALTH_CHECK_INTERVAL
        );
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
            this.status.isHealthy = false;
            this.status.dahdiStatus.isOpen = false;

            // Clean up event listeners
            this.removeAllListeners();
            
            logger.info('Hardware service shutdown complete');
            
        } catch (error) {
            logger.error('Error during hardware service shutdown:', error);
            throw error;
        }
    }
}