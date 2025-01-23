// src/config/dahdi.ts
//
// DAHDI configuration management. Handles reading and writing DAHDI configuration,
// validating settings, and providing typed access to DAHDI parameters.
// This class serves as the primary interface for managing DAHDI system configuration,
// ensuring type safety and proper validation of all settings.

import { promises as fs } from 'fs';
import { logger } from '../utils/logger';
import {
    DAHDISystemConfig,
    DAHDISpanConfig,
    DAHDIChannelConfig,
    DAHDISignalingType,
    DAHDIHardwareInfo
} from '../types/dahdi';

export class DAHDIConfig {
    private readonly configPath: string = '/etc/dahdi/system.conf';
    private readonly modulesPath: string = '/etc/dahdi/modules';
    private config: DAHDISystemConfig;
    private hardwareInfo: DAHDIHardwareInfo | null = null;

    constructor() {
        // Initialize with default configuration
        this.config = {
            echocancel: {
                enabled: true,
                taps: 128
            },
            loadzone: ['us'],
            defaultzone: 'us',
            spans: []
        };
    }

    /**
     * Load DAHDI configuration from system files
     */
    public async load(): Promise<void> {
        try {
            logger.info('Loading DAHDI configuration');
            
            // Read the main configuration file
            const configContent = await fs.readFile(this.configPath, 'utf-8');
            
            // Parse the configuration
            this.config = this.parseConfig(configContent);
            
            // Load hardware information
            await this.loadHardwareInfo();
            
            logger.info('DAHDI configuration loaded successfully', {
                spans: this.config.spans.length,
                loadzone: this.config.loadzone,
                defaultzone: this.config.defaultzone
            });
        } catch (error) {
            logger.error('Failed to load DAHDI configuration:', error);
            throw error;
        }
    }

    /**
     * Load hardware information from DAHDI system
     */
    private async loadHardwareInfo(): Promise<void> {
        try {
            // Use dahdi_hardware command to get info
            const { exec } = require('child_process');
            const output = await new Promise<string>((resolve, reject) => {
                exec('dahdi_hardware', (error: Error | null, stdout: string) => {
                    if (error) reject(error);
                    else resolve(stdout);
                });
            });

            this.hardwareInfo = this.parseHardwareInfo(output);
            logger.debug('DAHDI hardware info loaded', this.hardwareInfo);
        } catch (error) {
            logger.error('Failed to load hardware info:', error);
            throw error;
        }
    }

    /**
     * Parse DAHDI hardware info output
     */
    private parseHardwareInfo(output: string): DAHDIHardwareInfo {
        // Example output parsing for OpenVox A400P
        const lines = output.split('\n');
        const info: DAHDIHardwareInfo = {
            name: 'Unknown',
            location: '',
            spans: 0,
            channelsPerSpan: 0,
            manufacturer: '',
            capabilities: 0
        };

        for (const line of lines) {
            if (line.includes('OpenVox A400P')) {
                info.name = 'OpenVox A400P';
                info.spans = 1;
                info.channelsPerSpan = 4;
                info.manufacturer = 'OpenVox';
                break;
            }
        }

        return info;
    }

    /**
     * Parse DAHDI configuration file content
     */
    private parseConfig(content: string): DAHDISystemConfig {
        const config: DAHDISystemConfig = {
            echocancel: { enabled: false },
            loadzone: [],
            defaultzone: 'us',
            spans: []
        };

        const lines = content.split('\n');
        let currentSpan: DAHDISpanConfig | null = null;

        for (const line of lines) {
            const trimmed = line.trim();
            
            // Skip comments and empty lines
            if (trimmed.startsWith('#') || !trimmed) {
                continue;
            }

            // Parse configuration directives
            if (trimmed.startsWith('span=')) {
                currentSpan = this.parseSpanConfig(trimmed);
                config.spans.push(currentSpan);
            } else if (trimmed.startsWith('loadzone')) {
                config.loadzone = this.parseLoadZone(trimmed);
            } else if (trimmed.startsWith('defaultzone')) {
                config.defaultzone = this.parseDefaultZone(trimmed);
            } else if (trimmed.startsWith('echocanceller')) {
                config.echocancel = this.parseEchoCancel(trimmed);
            } else if (currentSpan && trimmed.match(/^fxs|fxo|bchan|dchan/)) {
                const channel = this.parseChannelConfig(trimmed);
                currentSpan.channels.push(channel);
            }
        }

        return config;
    }

    /**
     * Validate the entire configuration and hardware setup
     */
    public async validateSystem(): Promise<boolean> {
        try {
            // Validate configuration
            if (!this.validate()) {
                return false;
            }

            // Check hardware matches configuration
            if (this.hardwareInfo) {
                if (this.config.spans.length > this.hardwareInfo.spans) {
                    throw new Error('Configuration spans exceed hardware capabilities');
                }

                for (const span of this.config.spans) {
                    if (span.channels.length > this.hardwareInfo.channelsPerSpan) {
                        throw new Error(`Span ${span.span} has too many channels for hardware`);
                    }
                }
            }

            // Test DAHDI system status
            await this.testSystemStatus();

            return true;
        } catch (error) {
            logger.error('System validation failed:', error);
            return false;
        }
    }

    /**
     * Test DAHDI system status using dahdi_test
     */
    private async testSystemStatus(): Promise<void> {
        const { exec } = require('child_process');
        
        // Test each configured channel
        for (const span of this.config.spans) {
            for (const channel of span.channels) {
                await new Promise<void>((resolve, reject) => {
                    exec(`dahdi_test ${channel.channel}`, (error: Error | null) => {
                        if (error) {
                            logger.error(`Channel ${channel.channel} test failed:`, error);
                            reject(error);
                        } else {
                            logger.debug(`Channel ${channel.channel} test passed`);
                            resolve();
                        }
                    });
                });
            }
        }
    }

    /**
     * Save current configuration to system and apply changes
     */
    public async saveAndApply(): Promise<void> {
        try {
            // Save configuration
            await this.save();

            // Reload DAHDI system
            await this.reloadSystem();

            logger.info('DAHDI configuration saved and applied successfully');
        } catch (error) {
            logger.error('Failed to save and apply configuration:', error);
            throw error;
        }
    }

    /**
     * Reload DAHDI system to apply configuration changes
     */
    private async reloadSystem(): Promise<void> {
        const { exec } = require('child_process');
        
        try {
            // Execute DAHDI reload commands
            await new Promise<void>((resolve, reject) => {
                exec('dahdi_cfg -vv', (error: Error | null) => {
                    if (error) reject(error);
                    else resolve();
                });
            });

            logger.info('DAHDI system reloaded successfully');
        } catch (error) {
            logger.error('Failed to reload DAHDI system:', error);
            throw error;
        }
    }

    /**
     * Get channel configuration by channel number
     */
    public getChannelConfig(channelNumber: number): DAHDIChannelConfig | null {
        for (const span of this.config.spans) {
            const channel = span.channels.find(c => c.channel === channelNumber);
            if (channel) return channel;
        }
        return null;
    }

    /**
     * Update channel configuration
     */
    public async updateChannelConfig(
        channelNumber: number,
        config: Partial<DAHDIChannelConfig>
    ): Promise<void> {
        // Find and update channel configuration
        let updated = false;
        
        for (const span of this.config.spans) {
            const channelIndex = span.channels.findIndex(c => c.channel === channelNumber);
            if (channelIndex >= 0) {
                span.channels[channelIndex] = {
                    ...span.channels[channelIndex],
                    ...config
                };
                updated = true;
                break;
            }
        }

        if (!updated) {
            throw new Error(`Channel ${channelNumber} not found`);
        }

        // Save and apply changes
        await this.saveAndApply();
    }

    /**
     * Get the current configuration
     */
    public getConfig(): DAHDISystemConfig {
        return { ...this.config };
    }

    /**
     * Get hardware information
     */
    public getHardwareInfo(): DAHDIHardwareInfo | null {
        return this.hardwareInfo;
    }
}