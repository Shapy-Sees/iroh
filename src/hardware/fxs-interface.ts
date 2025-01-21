// src/hardware/fxs-interface.ts
//
// This file implements the FXS (Foreign Exchange Station) interface using
// Raspberry Pi GPIO pins for direct hardware communication.
// Handles audio streaming, control signals, and phone state management.

import { EventEmitter } from 'events';
import { Transform } from 'stream';
import { logger } from '../utils/logger';
import { FXSHardwareConfig } from '../config/fxs.config';

// Use require for rpio to avoid TypeScript import issues
const rpio = require('rpio');

// Remove duplicate FXSConfig interface and use FXSHardwareConfig instead

interface AudioBuffer {
    data: Buffer;
    timestamp: number;
}

export class FXSInterface extends EventEmitter {
    private isActive: boolean = false;
    private audioBuffer: AudioBuffer[] = [];
    private readonly config: Required<FXSHardwareConfig>;
    private audioStream: Transform;
    private pollInterval: NodeJS.Timeout | null = null;

    constructor(config: Partial<FXSHardwareConfig>) {
        super();
        
        // Set default values for optional config
        this.config = {
            devicePath: '/dev/ttyUSB0',
            sampleRate: 44100,
            hookPin: 17,
            audioInPin: 18,
            audioOutPin: 19,
            ringPin: 20,
            bufferSize: 320,
            channels: 1,
            bitDepth: 16,
            ...config
        };

        // Initialize audio stream processing
        this.audioStream = new Transform({
            transform: (chunk: Buffer, encoding: string, callback: Function) => {
                this.processAudioChunk(chunk);
                callback(null, chunk);
            }
        });

        // Only setup GPIO if not using device path
        if (!config.devicePath) {
            this.setupGPIO();
        }
    }

    private setupGPIO(): void {
        try {
            // Initialize GPIO only if we're not using a device path
            if (!this.config.devicePath) {
                rpio.init({
                    gpiomem: true,
                    mapping: 'gpio'
                });

                // Set up pins
                rpio.open(this.config.hookPin, rpio.INPUT, rpio.PULL_UP);
                rpio.open(this.config.audioInPin, rpio.INPUT);
                rpio.open(this.config.audioOutPin, rpio.OUTPUT);
                rpio.open(this.config.ringPin, rpio.OUTPUT);

                logger.info('GPIO initialized successfully');
            }
        } catch (error) {
            const err = error instanceof Error ? error : new Error('GPIO initialization failed');
            logger.error('Failed to initialize GPIO', err);
            throw err;
        }
    }

    public async start(): Promise<void> {
        try {
            // Start polling hook state
            this.startHookStatePolling();
            
            // Start audio sampling
            this.startAudioSampling();
            
            logger.info('FXS interface started');
            this.emit('ready');
        } catch (error) {
            const err = error instanceof Error ? error : new Error('Failed to start FXS interface');
            logger.error('Start failed', err);
            throw err;
        }
    }

    private startHookStatePolling(): void {
        // Poll hook state every 50ms
        this.pollInterval = setInterval(() => {
            const hookState = rpio.read(this.config.hookPin);
            
            if (hookState === rpio.LOW && !this.isActive) {
                // Phone went off hook
                this.isActive = true;
                this.emit('off_hook');
                logger.debug('Phone off hook detected');
            } else if (hookState === rpio.HIGH && this.isActive) {
                // Phone went on hook
                this.isActive = false;
                this.emit('on_hook');
                logger.debug('Phone on hook detected');
            }
        }, 50);
    }

    private startAudioSampling(): void {
        // Set up PWM for audio sampling
        rpio.pwmSetClockDivider(64);  // Set PWM clock
        rpio.pwmSetRange(this.config.audioOutPin, 1024);  // Set PWM range
        
        if (this.isActive) {
            // Start reading audio input
            setInterval(() => {
                if (this.isActive) {
                    const sample = rpio.read(this.config.audioInPin);
                    const buffer = Buffer.alloc(2);
                    buffer.writeInt16LE(sample * 32767, 0); // Convert to 16-bit PCM
                    this.audioStream.write(buffer);
                }
            }, 1000 / this.config.sampleRate);
        }
    }

    public async playAudio(buffer: Buffer): Promise<void> {
        if (!this.isActive) {
            throw new Error('FXS interface is not active');
        }

        try {
            // Process audio buffer in chunks
            for (let i = 0; i < buffer.length; i += 2) {
                const sample = buffer.readInt16LE(i) / 32767; // Convert from 16-bit PCM
                const pwmValue = Math.floor((sample + 1) * 512); // Scale to PWM range
                rpio.pwmSetData(this.config.audioOutPin, pwmValue);
                await this.delay(1000 / this.config.sampleRate);
            }
        } catch (error) {
            const err = error instanceof Error ? error : new Error('Failed to play audio');
            logger.error('Audio playback failed', err);
            throw err;
        }
    }

    public async stop(): Promise<void> {
        try {
            // Stop polling
            if (this.pollInterval) {
                clearInterval(this.pollInterval);
            }

            // Clean up GPIO
            rpio.close(this.config.hookPin);
            rpio.close(this.config.audioInPin);
            rpio.close(this.config.audioOutPin);
            rpio.close(this.config.ringPin);

            this.isActive = false;
            this.audioBuffer = [];
            
            logger.info('FXS interface stopped');
        } catch (error) {
            const err = error instanceof Error ? error : new Error('Failed to stop FXS interface');
            logger.error('Stop failed', err);
            throw err;
        }
    }

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    public isOpen(): boolean {
        return this.isActive;
    }

    public getConfig(): Required<FXSHardwareConfig> {
        return { ...this.config };
    }

    private processAudioChunk(chunk: Buffer): void {
        const formattedBuffer: AudioBuffer = {
            data: chunk,
            timestamp: Date.now()
        };

        this.audioBuffer.push(formattedBuffer);
        this.emit('audio', formattedBuffer);
        this.cleanupAudioBuffer();
    }

    private cleanupAudioBuffer(): void {
        const now = Date.now();
        const maxAge = 1000; // 1 second buffer
        this.audioBuffer = this.audioBuffer.filter(
            buffer => now - buffer.timestamp < maxAge
        );
    }
}