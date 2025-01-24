// src/hardware/fxs-interface.ts
//
// FXS (Foreign Exchange Station) hardware interface implementation
// Handles direct communication with DAHDI hardware for phone operations

import { EventEmitter } from 'events';
import * as fs from 'fs';
import { FileHandle } from 'fs/promises';
import { Readable, ReadableOptions } from 'stream';
import { AudioInput } from '../types';
import { logger } from '../utils/logger';

// DAHDI device constants and commands
const DAHDI_COMMANDS = {
    HOOK: 0x40045408,  // Hook state ioctl
    RING: 0x40045409,  // Ring control ioctl
    AUDIO: 0x4004540A, // Audio control ioctl
    CONTROL: '/dev/dahdi/ctl'
} as const;

interface FXSConfig {
    devicePath?: string;
    sampleRate: number;
    channels?: number;
    bitDepth?: number;
}




export class FXSInterface extends EventEmitter {
    private fileHandle: FileHandle | null = null;
    private isActive: boolean = false;
    private readonly config: Required<FXSConfig>;
    private audioStream: DAHDIReadStream | null = null;

    constructor(config: FXSConfig) {
        super();
        
        // Create configuration with defaults first
        const defaultConfig: Required<FXSConfig> = {
            devicePath: '/dev/dahdi/channel001',
            channels: 1,
            bitDepth: 16,
            sampleRate: 8000
        };

        // Merge with provided config, being explicit about which properties to override
        this.config = {
            ...defaultConfig,
            devicePath: config.devicePath || defaultConfig.devicePath,
            sampleRate: config.sampleRate,
            channels: config.channels || defaultConfig.channels,
            bitDepth: config.bitDepth || defaultConfig.bitDepth
        };

        logger.debug('Initializing FXS interface', { config: this.config });
    }

    public async start(): Promise<void> {
        try {
            // Open DAHDI device with proper typing
            this.fileHandle = await fs.promises.open(this.config.devicePath, 'r+');
            
            // Start monitoring hook state
            await this.startHookStateMonitoring();
            
            // Start audio streaming
            await this.startAudioStreaming();
            
            logger.info('FXS interface started successfully');
            this.emit('ready');
        } catch (error) {
            logger.error('Failed to start FXS interface:', error);
            throw error;
        }
    }

    private async startAudioStreaming(): Promise<void> {
        if (!this.fileHandle) {
            throw new Error('Device not open');
        }

        try {
            // Calculate buffer size based on sample rate and frame duration
            const frameSize = Math.floor(this.config.sampleRate * 0.02); // 20ms frames
            
            // Create custom read stream for DAHDI
            this.audioStream = new DAHDIReadStream(this.fileHandle.fd, {
                highWaterMark: frameSize * 2 // 16-bit samples
            });

            // Handle stream events
            this.audioStream.on('data', (chunk: Buffer) => {
                if (this.isActive) {
                    const audioInput: AudioInput = {
                        sampleRate: this.config.sampleRate,
                        channels: this.config.channels,
                        bitDepth: this.config.bitDepth,
                        data: chunk
                    };
                    this.emit('audio', audioInput);
                }
            });

            this.audioStream.on('error', (error) => {
                logger.error('Audio stream error:', error);
                this.emit('error', error);
            });

        } catch (error) {
            logger.error('Failed to start audio streaming:', error);
            throw error;
        }
    }

    public async playAudio(buffer: Buffer): Promise<void> {
        if (!this.fileHandle || !this.isActive) {
            throw new Error('Cannot play audio - device not ready or inactive');
        }

        try {
            // Write audio data with proper error handling
            const { bytesWritten } = await this.fileHandle.write(buffer);
            
            if (bytesWritten !== buffer.length) {
                throw new Error('Failed to write complete audio buffer');
            }

            logger.debug('Audio playback complete', { bytes: bytesWritten });
        } catch (error) {
            logger.error('Error playing audio:', error);
            throw error;
        }
    }

    public async ring(duration: number = 2000): Promise<void> {
        if (!this.fileHandle) {
            throw new Error('Device not open');
        }

        try {
            // Send ring command using proper buffer handling
            const buffer = Buffer.alloc(4);
            buffer.writeInt32LE(1, 0); // 1 = start ringing
            
            await this.dahdiIoctl(DAHDI_COMMANDS.RING, buffer);

            // Stop ringing after duration
            setTimeout(async () => {
                buffer.writeInt32LE(0, 0); // 0 = stop ringing
                await this.dahdiIoctl(DAHDI_COMMANDS.RING, buffer);
            }, duration);

            logger.debug('Ring signal sent', { duration });
        } catch (error) {
            logger.error('Error sending ring signal:', error);
            throw error;
        }
    }

    private async dahdiIoctl(command: number, buffer: Buffer): Promise<void> {
        // Implementation would use Node.js native bindings for ioctl
        // This is a placeholder that logs the command for now
        logger.debug('DAHDI ioctl', { command, buffer });
    }

    public async stop(): Promise<void> {
        try {
            // Clean up audio stream
            if (this.audioStream) {
                this.audioStream.destroy();
                this.audioStream = null;
            }

            // Close DAHDI device
            if (this.fileHandle) {
                await this.fileHandle.close();
                this.fileHandle = null;
            }

            this.isActive = false;
            logger.info('FXS interface stopped');
        } catch (error) {
            logger.error('Error stopping FXS interface:', error);
            throw error;
        }
    }

    public isOpen(): boolean {
        return this.fileHandle !== null;
    }
}