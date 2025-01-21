// src/controllers/phone-controller.ts
//
// This file implements the main phone controller that manages:
// - FXS hardware interface
// - DTMF detection and command routing
// - Audio playback and recording
// - Phone state management (on-hook, off-hook, etc)
// - Feedback tones and audio responses

import { EventEmitter } from 'events';
import { FXSInterface } from '../hardware/fxs-interface';
import { DTMFDetector } from '../audio/dtmf-detector';
import { AudioInput } from '../types';
import { logger } from '../utils/logger';
import { FXSHardwareConfig, fxsConfig } from '../config/fxs.config';

interface PhoneControllerConfig {
    fxs: Required<Pick<FXSHardwareConfig, 'sampleRate'>> & Partial<FXSHardwareConfig>;
}

export class PhoneController extends EventEmitter {
    private fxs: FXSInterface;
    private dtmfDetector: DTMFDetector;
    private isActive: boolean = false;
    private readonly feedbackTones: Map<string, Buffer>;
    private readonly config: PhoneControllerConfig;
    private commandBuffer: string[] = [];
    private lastCommandTime: number = 0;

    constructor(config: PhoneControllerConfig = { fxs: fxsConfig }) {
        super();
        this.config = config;
        
        // Ensure sampleRate is available for DTMF detector
        const dtmfConfig = {
            sampleRate: Number(config.fxs.sampleRate)
        };
        
        // Initialize FXS interface with configuration
        this.fxs = new FXSInterface(config.fxs);
        
        // Initialize DTMF detector
        this.dtmfDetector = new DTMFDetector(dtmfConfig);

        // Create standard feedback tones
        this.feedbackTones = this.initializeFeedbackTones();
        
        // Set up event handlers
        this.setupEventHandlers();
    }

    private initializeFeedbackTones(): Map<string, Buffer> {
        const tones = new Map<string, Buffer>();
        
        // Generate common phone tones
        tones.set('dial', this.generateTone(350, 440, 1.0));  // Dial tone
        tones.set('confirm', this.generateTone(600, 0, 0.2)); // Confirmation beep
        tones.set('error', this.generateTone(480, 620, 0.3)); // Error tone
        tones.set('busy', this.generateTone(480, 620, 0.5));  // Busy signal
        
        return tones;
    }

    private generateTone(freq1: number, freq2: number, duration: number): Buffer {
        const sampleRate = Number(this.config.fxs.sampleRate);
        const samples = Math.floor(sampleRate * duration);
        const buffer = Buffer.alloc(samples * 2); // 16-bit samples

        for (let i = 0; i < samples; i++) {
            const t = i / sampleRate;
            let sample = Math.sin(2 * Math.PI * freq1 * t);
            if (freq2 > 0) {
                sample += Math.sin(2 * Math.PI * freq2 * t);
                sample *= 0.5; // Normalize amplitude
            }
            
            // Convert to 16-bit PCM
            const value = Math.floor(sample * 32767);
            buffer.writeInt16LE(value, i * 2);
        }

        return buffer;
    }

    private setupEventHandlers(): void {
        // Handle FXS events
        this.fxs.on('off_hook', () => this.handleOffHook());
        this.fxs.on('on_hook', () => this.handleOnHook());
        this.fxs.on('audio', (data) => this.handleAudioData(data));
        this.fxs.on('error', (error: Error) => this.handleError(error));

        // Handle DTMF events
        this.dtmfDetector.on('dtmf', (event) => this.handleDTMF(event));
    }

    public async start(): Promise<void> {
        try {
            logger.info('Starting phone controller');
            await this.fxs.start();
            this.emit('ready');
        } catch (error) {
            const err = error instanceof Error ? error : new Error('Unknown error during phone controller start');
            logger.error('Failed to start phone controller:', err);
            throw err;
        }
    }

    public async stop(): Promise<void> {
        try {
            logger.info('Stopping phone controller');
            this.isActive = false;
            await this.fxs.stop();
            this.dtmfDetector.shutdown();
            this.removeAllListeners();
        } catch (error) {
            const err = error instanceof Error ? error : new Error('Unknown error during phone controller stop');
            logger.error('Error stopping phone controller:', err);
            throw err;
        }
    }

    public async playTone(type: 'confirm' | 'error' | 'dial' | 'busy'): Promise<void> {
        const tone = this.feedbackTones.get(type);
        if (!tone || !this.isActive) {
            logger.warn('Cannot play tone:', { type, isActive: this.isActive });
            return;
        }

        try {
            await this.fxs.playAudio(tone);
        } catch (error) {
            const err = error instanceof Error ? error : new Error('Unknown error playing tone');
            logger.error('Error playing tone:', err);
            throw err;
        }
    }

    public async playAudio(buffer: Buffer): Promise<void> {
        if (!this.isActive) {
            logger.warn('Cannot play audio - phone is not active');
            return;
        }

        try {
            await this.fxs.playAudio(buffer);
        } catch (error) {
            const err = error instanceof Error ? error : new Error('Unknown error playing audio');
            logger.error('Error playing audio:', err);
            await this.playTone('error').catch(e => logger.error('Error playing error tone:', e));
            throw err;
        }
    }

    private async handleOffHook(): Promise<void> {
        logger.info('Phone off hook');
        this.isActive = true;
        this.commandBuffer = [];
        await this.playTone('dial');
        this.emit('off_hook');
    }

    private async handleOnHook(): Promise<void> {
        logger.info('Phone on hook');
        this.isActive = false;
        this.commandBuffer = [];
        this.emit('on_hook');
    }

    private async handleAudioData(audioInput: AudioInput): Promise<void> {
        if (!this.isActive) return;

        try {
            // Process for DTMF tones
            await this.dtmfDetector.analyze(audioInput);
            
            // Emit audio data for voice processing
            this.emit('audio', audioInput);
        } catch (error) {
            const err = error instanceof Error ? error : new Error('Unknown error processing audio');
            logger.error('Error processing audio:', err);
            this.handleError(err);
        }
    }

    private async handleDTMF(event: { digit: string; duration: number }): Promise<void> {
        const now = Date.now();
        const commandTimeout = 2000; // 2 seconds timeout for command sequence

        // Reset command buffer if too much time has passed
        if (now - this.lastCommandTime > commandTimeout) {
            this.commandBuffer = [];
        }

        // Add digit to command buffer
        this.commandBuffer.push(event.digit);
        this.lastCommandTime = now;

        // Emit DTMF event
        this.emit('dtmf', event);

        // Check for complete commands
        await this.checkCommands();
    }

    private async checkCommands(): Promise<void> {
        const sequence = this.commandBuffer.join('');
        
        // Check for special commands
        if (sequence.endsWith('#')) {
            // Complete command detected
            this.emit('command', sequence.slice(0, -1));
            this.commandBuffer = [];
            await this.playTone('confirm').catch(e => 
                logger.error('Error playing confirmation tone:', e instanceof Error ? e : new Error(String(e)))
            );
        } else if (sequence.length >= 8) {
            // Command too long, reset
            this.commandBuffer = [];
            await this.playTone('error').catch(e => 
                logger.error('Error playing error tone:', e instanceof Error ? e : new Error(String(e)))
            );
        }
    }

    private handleError(error: Error): void {
        logger.error('Phone controller error:', error);
        this.emit('error', error);
    }
}