// src/hardware/fxs-interface.ts
//
// FXS (Foreign Exchange Station) interface implementation using DAHDI drivers.
// Handles audio streaming, control signals, and phone state management.
// Provides a high-level interface for phone controller to interact with FXS hardware.

import { EventEmitter } from 'events';
import { promises as fs } from 'fs';
import { AudioInput } from '../types';
import { logger } from '../utils/logger';

// DAHDI device paths
const DAHDI_DEVICE = '/dev/dahdi/channel001';
const DAHDI_CTL = '/dev/dahdi/ctl';

// DAHDI constants
const DAHDI_HOOK = 0x40045408;  // Hook state ioctl
const DAHDI_RING = 0x40045409;  // Ring control ioctl
const DAHDI_AUDIO = 0x4004540A; // Audio control ioctl

interface FXSConfig {
    devicePath?: string;
    sampleRate: number;
    channels?: number;
    bitDepth?: number;
}

export class FXSInterface extends EventEmitter {
    private fd: number | null = null;
    private isActive: boolean = false;
    private readonly config: Required<FXSConfig>;
    private audioStream: NodeJS.ReadStream | null = null;

    constructor(config: FXSConfig) {
        super();
        
        // Set default configuration values
        this.config = {
            devicePath: DAHDI_DEVICE,
            sampleRate: config.sampleRate,
            channels: 1,
            bitDepth: 16,
            ...config
        };

        logger.debug('Initializing FXS interface', { config: this.config });
    }

    public async start(): Promise<void> {
        try {
            // Open DAHDI device
            this.fd = await fs.open(this.config.devicePath, 'r+');
            
            // Start monitoring hook state
            this.startHookStateMonitoring();
            
            // Start audio streaming
            this.startAudioStreaming();
            
            logger.info('FXS interface started successfully');
            this.emit('ready');
        } catch (error) {
            logger.error('Failed to start FXS interface:', error);
            throw error;
        }
    }

    private async startHookStateMonitoring(): Promise<void> {
        // Set up polling interval to check hook state
        setInterval(async () => {
            try {
                const hookState = await this.getHookState();
                if (hookState && !this.isActive) {
                    // Phone went off hook
                    this.isActive = true;
                    this.emit('off_hook');
                    logger.debug('Phone off hook detected');
                } else if (!hookState && this.isActive) {
                    // Phone went on hook
                    this.isActive = false;
                    this.emit('on_hook');
                    logger.debug('Phone on hook detected');
                }
            } catch (error) {
                logger.error('Error checking hook state:', error);
            }
        }, 50); // Poll every 50ms
    }

    private async getHookState(): Promise<boolean> {
        if (!this.fd) throw new Error('Device not open');

        // Read hook state using DAHDI ioctl
        const buffer = Buffer.alloc(4);
        await fs.read(this.fd, buffer, 0, 4, null);
        return (buffer.readInt32LE(0) !== 0);
    }

    private startAudioStreaming(): void {
        if (!this.fd) throw new Error('Device not open');

        // Create read stream for audio input
        this.audioStream = fs.createReadStream('', {
            fd: this.fd,
            highWaterMark: this.config.sampleRate * this.config.channels * 2 / 50 // 20ms chunks
        });

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
    }

    public async playAudio(buffer: Buffer): Promise<void> {
        if (!this.fd || !this.isActive) {
            throw new Error('Cannot play audio - device not ready or inactive');
        }

        try {
            // Write audio data to DAHDI device
            await fs.write(this.fd, buffer);
            logger.debug('Audio playback complete', { bytes: buffer.length });
        } catch (error) {
            logger.error('Error playing audio:', error);
            throw error;
        }
    }

    public async ring(duration: number = 2000): Promise<void> {
        if (!this.fd) throw new Error('Device not open');

        try {
            // Send ring command using DAHDI ioctl
            const buffer = Buffer.alloc(4);
            buffer.writeInt32LE(1, 0); // 1 = start ringing
            await this.dahdiIoctl(DAHDI_RING, buffer);

            // Stop ringing after duration
            setTimeout(async () => {
                buffer.writeInt32LE(0, 0); // 0 = stop ringing
                await this.dahdiIoctl(DAHDI_RING, buffer);
            }, duration);

            logger.debug('Ring signal sent', { duration });
        } catch (error) {
            logger.error('Error sending ring signal:', error);
            throw error;
        }
    }

    private async dahdiIoctl(command: number, buffer: Buffer): Promise<void> {
        // Helper function to send DAHDI ioctl commands
        // Implementation would use Node.js native bindings to send actual ioctl
        logger.debug('DAHDI ioctl', { command, buffer });
    }

    public async stop(): Promise<void> {
        try {
            // Stop audio streaming
            if (this.audioStream) {
                this.audioStream.destroy();
                this.audioStream = null;
            }

            // Close DAHDI device
            if (this.fd !== null) {
                await fs.close(this.fd);
                this.fd = null;
            }

            this.isActive = false;
            logger.info('FXS interface stopped');
        } catch (error) {
            logger.error('Error stopping FXS interface:', error);
            throw error;
        }
    }

    public isOpen(): boolean {
        return this.fd !== null;
    }
}