// src/controllers/phone-controller.ts
//
// Phone controller that manages:
// - DAHDI hardware interface through FXS
// - DTMF detection and command routing
// - Audio playback and recording
// - Phone state management
// - Feedback tones and audio responses
// The controller coordinates between the hardware layer and higher-level services

import { EventEmitter } from 'events';
import { FXSInterface } from '../hardware/fxs-interface';
import { DTMFDetector } from '../audio/dtmf-detector';
import { AudioInput, PhoneControllerConfig } from '../types';
import { logger } from '../utils/logger';
import { EVENTS, ERROR_CODES } from '../core/constants';

// Define feedback tone types
export type ToneType = 'dial' | 'busy' | 'confirm' | 'error' | 'ring';
export class PhoneController extends EventEmitter {
    private fxs: FXSInterface;
    private dtmfDetector: DTMFDetector;
    private isActive: boolean = false;
    private readonly feedbackTones: Map<ToneType, Buffer>;
    private readonly config: Required<PhoneControllerConfig>;
    private commandBuffer: string[] = [];
    private lastCommandTime: number = 0;
    private readonly COMMAND_TIMEOUT = 2000; // 2 seconds
    private readonly MAX_COMMAND_LENGTH = 8;

    constructor(config: PhoneControllerConfig) {
        super();
        
        // Initialize configuration with proper merging
        this.config = {
            fxs: {
                devicePath: config.fxs?.devicePath || '/dev/dahdi/channel001',
                sampleRate: config.fxs?.sampleRate || 8000,
            },
            audio: {
                bufferSize: config.audio?.bufferSize || 320,
                channels: config.audio?.channels || 1,
                bitDepth: config.audio?.bitDepth || 16,
            },
            ai: config.ai || {}
        };

        logger.debug('Initializing phone controller', {
            config: this.stripSensitiveData(this.config)
        });

        // Initialize FXS interface
        this.fxs = new FXSInterface(this.config.fxs);
        
        // Initialize DTMF detector with DAHDI settings
        this.dtmfDetector = new DTMFDetector({
            sampleRate: this.config.fxs.sampleRate,
            minDuration: 40  // 40ms minimum for valid DTMF
        });

        // Initialize feedback tones for DAHDI
        this.feedbackTones = this.initializeFeedbackTones();
        
        // Set up event handlers
        this.setupEventHandlers();
    }

    private stripSensitiveData(config: any): any {
        const sanitized = { ...config };
        if (sanitized.ai?.anthropicKey) sanitized.ai.anthropicKey = '***';
        return sanitized;
    }

    private initializeFeedbackTones(): Map<ToneType, Buffer> {
        const tones = new Map<ToneType, Buffer>();
        
        // Generate DAHDI-compatible tones
        tones.set('dial', this.generateTone(350, 440, 1.0));   // Dial tone
        tones.set('busy', this.generateTone(480, 620, 0.5));   // Busy signal
        tones.set('confirm', this.generateTone(600, 0, 0.2));  // Confirmation beep
        tones.set('error', this.generateTone(480, 620, 0.3));  // Error tone
        tones.set('ring', this.generateTone(440, 480, 2.0));   // Ring tone
        
        return tones;
    }

    private generateTone(freq1: number, freq2: number, duration: number): Buffer {
        // Generate 16-bit PCM audio buffer for DAHDI
        const sampleRate = this.config.fxs.sampleRate;
        const samples = Math.floor(sampleRate * duration);
        const buffer = Buffer.alloc(samples * 2);  // 2 bytes per sample

        for (let i = 0; i < samples; i++) {
            const t = i / sampleRate;
            let sample = Math.sin(2 * Math.PI * freq1 * t);
            if (freq2 > 0) {
                sample += Math.sin(2 * Math.PI * freq2 * t);
                sample *= 0.5; // Normalize amplitude
            }
            
            // Convert to 16-bit PCM for DAHDI
            const value = Math.floor(sample * 32767);
            buffer.writeInt16LE(value, i * 2);
        }

        return buffer;
    }

    private setupEventHandlers(): void {
        // Handle FXS events from DAHDI
        this.fxs.on('off_hook', () => this.handleOffHook());
        this.fxs.on('on_hook', () => this.handleOnHook());
        this.fxs.on('audio', (data) => this.handleAudioData(data));
        this.fxs.on('ring_start', () => this.handleRingStart());
        this.fxs.on('ring_stop', () => this.handleRingStop());
        this.fxs.on('error', (error: Error) => this.handleError(error));

        // Handle DTMF events
        this.dtmfDetector.on('dtmf', (event) => this.handleDTMF(event));

        logger.debug('Phone controller event handlers initialized');
    }

    public async start(): Promise<void> {
        try {
            logger.info('Starting phone controller');
            await this.fxs.start();
            this.emit('ready');
            logger.info('Phone controller started successfully');
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            logger.error('Failed to start phone controller:', err);
            throw err;
        }
    }

    public getFXSInterface(): FXSInterface {
        return this.fxs;
    }

    public async playTone(type: ToneType): Promise<void> {
        if (!this.isActive) {
            logger.warn('Cannot play tone - phone is not active');
            return;
        }

        const tone = this.feedbackTones.get(type);
        if (!tone) {
            logger.warn('Tone not found:', { type });
            return;
        }

        try {
            await this.fxs.playAudio(tone);
            logger.debug('Played tone', { type });
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
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
            logger.debug('Played audio buffer', { bytes: buffer.length });
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            logger.error('Error playing audio:', err);
            await this.playTone('error').catch(e => 
                logger.error('Error playing error tone:', e)
            );
            throw err;
        }
    }

    private async handleOffHook(): Promise<void> {
        logger.info('Phone off hook detected');
        this.isActive = true;
        this.commandBuffer = [];
        await this.playTone('dial');
        this.emit(EVENTS.PHONE.OFF_HOOK);
    }

    private async handleOnHook(): Promise<void> {
        logger.info('Phone on hook detected');
        this.isActive = false;
        this.commandBuffer = [];
        this.emit(EVENTS.PHONE.ON_HOOK);
    }

    private async handleAudioData(audioInput: AudioInput): Promise<void> {
        if (!this.isActive) return;

        try {
            // Process for DTMF using DAHDI's detection
            await this.dtmfDetector.analyze(audioInput);
            
            // Emit audio data for voice processing
            this.emit('audio', audioInput);
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            logger.error('Error processing audio:', err);
            this.handleError(err);
        }
    }

    private async handleDTMF(event: { digit: string; duration: number }): Promise<void> {
        const now = Date.now();

        // Reset command buffer if timeout exceeded
        if (now - this.lastCommandTime > this.COMMAND_TIMEOUT) {
            this.commandBuffer = [];
        }

        // Add digit to command buffer
        this.commandBuffer.push(event.digit);
        this.lastCommandTime = now;

        logger.debug('DTMF received', { 
            digit: event.digit,
            bufferLength: this.commandBuffer.length
        });

        // Emit DTMF event
        this.emit(EVENTS.PHONE.DTMF, event);

        // Check for complete commands
        await this.checkCommands();
    }

    private async checkCommands(): Promise<void> {
        const sequence = this.commandBuffer.join('');
        
        // Check for special commands
        if (sequence.endsWith('#')) {
            // Complete command detected
            const command = sequence.slice(0, -1);
            logger.info('Command sequence detected', { command });
            
            this.emit('command', command);
            this.commandBuffer = [];
            
            await this.playTone('confirm').catch(e => 
                logger.error('Error playing confirmation tone:', e)
            );
        } else if (sequence.length >= this.MAX_COMMAND_LENGTH) {
            // Command too long, reset
            logger.warn('Command sequence too long, resetting');
            this.commandBuffer = [];
            
            await this.playTone('error').catch(e => 
                logger.error('Error playing error tone:', e)
            );
        }
    }

    private async handleRingStart(): Promise<void> {
        logger.debug('Ring start detected');
        // Handle incoming call ring
        await this.playTone('ring');
    }

    private async handleRingStop(): Promise<void> {
        logger.debug('Ring stop detected');
        // Clean up any ring-related state
    }

    private handleError(error: Error): void {
        logger.error('Phone controller error:', error);
        this.emit(EVENTS.SYSTEM.ERROR, {
            code: ERROR_CODES.HARDWARE.FXS_ERROR,
            error
        });
    }

    public isPhoneActive(): boolean {
        return this.isActive;
    }

    public async stop(): Promise<void> {
        try {
            logger.info('Stopping phone controller');
            this.isActive = false;
            await this.fxs.stop();
            this.dtmfDetector.shutdown();
            this.removeAllListeners();
            logger.info('Phone controller stopped successfully');
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            logger.error('Error stopping phone controller:', err);
            throw err;
        }
    }
}