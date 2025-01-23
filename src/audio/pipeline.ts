// src/audio/pipeline.ts
//
// Our audio pipeline manages the flow of audio data through the system.
// It coordinates between different audio processing components like
// DTMF detection and voice activity detection, handling the routing
// and processing of audio from DAHDI through our various detectors
// and analysis components.

import { EventEmitter } from 'events';
import { AudioInput, DTMFEvent, VoiceEvent, AudioEventHandler } from './types';
import { DTMFDetector } from './dtmf-detector';
import { VoiceDetector } from './voice-detector';
import { logger } from '../utils/logger';

export class AudioPipeline extends EventEmitter {
    private dtmfDetector: DTMFDetector;
    private voiceDetector: VoiceDetector;
    private isProcessing: boolean = false;
    private handlers: Map<string, AudioEventHandler[]> = new Map();

    constructor() {
        super();
        // Initialize our audio processing components with DAHDI-compatible settings
        const dahdiSettings = {
            sampleRate: 8000,    // DAHDI uses 8kHz sampling
            channels: 1,         // Mono audio
            bitDepth: 16         // 16-bit samples
        };

        this.dtmfDetector = new DTMFDetector({
            sampleRate: dahdiSettings.sampleRate,
            minDuration: 40,     // 40ms minimum for valid DTMF
            bufferSize: 160      // 20ms frames at 8kHz
        });

        this.voiceDetector = new VoiceDetector({
            sampleRate: dahdiSettings.sampleRate,
            frameDuration: 20,   // 20ms frames
            vadThreshold: 0.015, // Voice activity detection threshold
            silenceThreshold: 500 // 500ms silence to end segment
        });

        // Set up internal event handlers
        this.setupEventHandlers();
        
        logger.info('Audio pipeline initialized', { settings: dahdiSettings });
    }

    private setupEventHandlers(): void {
        // Handle DTMF detection events
        this.dtmfDetector.on('dtmf', async (event) => {
            try {
                await this.handleDTMF(event);
            } catch (error) {
                logger.error('Error handling DTMF event:', error);
                this.emit('error', error);
            }
        });

        // Handle voice detection events
        this.voiceDetector.on('voice', async (event) => {
            try {
                await this.handleVoice(event);
            } catch (error) {
                logger.error('Error handling voice event:', error);
                this.emit('error', error);
            }
        });
    }

    public async processAudio(input: AudioInput): Promise<void> {
        // Check if we're already processing a frame
        if (this.isProcessing) {
            logger.warn('Audio pipeline is busy, dropping frame');
            return;
        }

        try {
            this.isProcessing = true;
            logger.debug('Processing audio frame', {
                length: input.data.length,
                sampleRate: input.sampleRate
            });

            // First, check for DTMF tones as they take priority
            const dtmfResult = await this.dtmfDetector.analyze(input);
            if (dtmfResult) {
                logger.debug('DTMF detected', { digit: dtmfResult.digit });
                await this.handleDTMF(dtmfResult);
                return; // Skip voice processing if DTMF detected
            }

            // If no DTMF, process for voice
            const voiceResult = await this.voiceDetector.analyze(input);
            if (voiceResult) {
                logger.debug('Voice segment detected', {
                    duration: voiceResult.endTime - voiceResult.startTime
                });
                await this.handleVoice(voiceResult);
            }

        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            logger.error('Error processing audio:', err);
            this.emit('error', err);
        } finally {
            this.isProcessing = false;
        }
    }

    private async handleDTMF(event: DTMFEvent): Promise<void> {
        // Get all registered DTMF handlers
        const handlers = this.handlers.get('dtmf') || [];
        
        try {
            // Execute all handlers in parallel
            await Promise.all(handlers.map(handler => {
                logger.debug('Executing DTMF handler', { digit: event.digit });
                return handler(event);
            }));

            // Emit DTMF event for other listeners
            this.emit('dtmf', event);
        } catch (error) {
            logger.error('Error in DTMF handler:', error);
            this.emit('error', error);
        }
    }

    private async handleVoice(event: VoiceEvent): Promise<void> {
        // Get all registered voice handlers
        const handlers = this.handlers.get('voice') || [];
        
        try {
            // Execute all handlers in parallel
            await Promise.all(handlers.map(handler => {
                logger.debug('Executing voice handler', {
                    duration: event.endTime - event.startTime
                });
                return handler(event);
            }));

            // Emit voice event for other listeners
            this.emit('voice', event);
        } catch (error) {
            logger.error('Error in voice handler:', error);
            this.emit('error', error);
        }
    }

    public addHandler(eventType: 'dtmf' | 'voice', handler: AudioEventHandler): void {
        logger.debug('Adding audio handler', { eventType });
        
        // Get or create handler array for this event type
        const handlers = this.handlers.get(eventType) || [];
        handlers.push(handler);
        this.handlers.set(eventType, handlers);
    }

    public removeHandler(eventType: 'dtmf' | 'voice', handler: AudioEventHandler): void {
        logger.debug('Removing audio handler', { eventType });
        
        const handlers = this.handlers.get(eventType);
        if (handlers) {
            const index = handlers.indexOf(handler);
            if (index !== -1) {
                handlers.splice(index, 1);
            }
        }
    }

    public getHandlerCount(eventType: 'dtmf' | 'voice'): number {
        return this.handlers.get(eventType)?.length || 0;
    }

    public async shutdown(): Promise<void> {
        logger.info('Shutting down audio pipeline');
        
        try {
            // Shutdown detectors
            this.dtmfDetector.shutdown();
            this.voiceDetector.shutdown();

            // Clear all handlers and listeners
            this.handlers.clear();
            this.removeAllListeners();

            logger.info('Audio pipeline shutdown complete');
        } catch (error) {
            logger.error('Error during audio pipeline shutdown:', error);
            throw error;
        }
    }
}