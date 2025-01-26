// src/audio/pipeline.ts
//
// Audio pipeline that manages the flow of audio data through the system.
// Coordinates between different audio processing components including:
// - DTMF detection for telephone keypad input
// - Voice activity detection for speech commands
// - Audio format conversion for DAHDI compatibility
// - Event routing and handling
// Maintains type safety and proper error handling throughout the pipeline.

import { EventEmitter } from 'events';
import { 
    AudioInput, 
    AudioOutput,
    DTMFEvent, 
    VoiceEvent,
    ServiceStatus,
    Result,
    EventHandler
} from '../types';
import { DTMFDetector } from './dtmf-detector';
import { VoiceDetector } from './voice-detector';
import { logger } from '../utils/logger';

// Pipeline status tracking
interface PipelineStatus extends ServiceStatus {
    isProcessing: boolean;
    processedFrames: number;
    droppedFrames: number;
    lastProcessingTime: number;
}

export class AudioPipeline extends EventEmitter {
    private dtmfDetector: DTMFDetector;
    private voiceDetector: VoiceDetector;
    private status: PipelineStatus;
    private handlers: Map<string, EventHandler[]>;

    constructor() {
        super();
        
        // Initialize with DAHDI-compatible settings
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

        // Initialize status tracking
        this.status = {
            isInitialized: false,
            isHealthy: true,
            isProcessing: false,
            processedFrames: 0,
            droppedFrames: 0,
            lastProcessingTime: 0,
            metrics: {
                uptime: 0,
                errors: 0,
                warnings: 0,
                lastChecked: new Date()
            }
        };

        this.handlers = new Map();
        
        // Set up internal event handlers
        this.setupEventHandlers();
        
        this.status.isInitialized = true;
        logger.info('Audio pipeline initialized', { settings: dahdiSettings });
    }

    private setupEventHandlers(): void {
        // Handle DTMF detection events
        this.dtmfDetector.on('dtmf', async (event: DTMFEvent) => {
            try {
                await this.handleDTMF(event);
            } catch (error) {
                this.status.metrics.errors++;
                logger.error('Error handling DTMF event:', error);
                this.emit('error', error);
            }
        });

        // Handle voice detection events
        this.voiceDetector.on('voice', async (event: VoiceEvent) => {
            try {
                await this.handleVoice(event);
            } catch (error) {
                this.status.metrics.errors++;
                logger.error('Error handling voice event:', error);
                this.emit('error', error);
            }
        });
    }

    public async processAudio(input: AudioInput): Promise<Result<void>> {
        // Check if we're already processing a frame
        if (this.status.isProcessing) {
            this.status.droppedFrames++;
            logger.warn('Audio pipeline is busy, dropping frame', {
                droppedFrames: this.status.droppedFrames
            });
            return { success: true, data: undefined };
        }

        const startTime = Date.now();
        try {
            this.status.isProcessing = true;
            logger.debug('Processing audio frame', {
                length: input.data.length,
                sampleRate: input.sampleRate
            });

            // First, check for DTMF tones as they take priority
            const dtmfResult = await this.dtmfDetector.analyze(input);
            if (dtmfResult) {
                logger.debug('DTMF detected', { digit: dtmfResult.digit });
                await this.handleDTMF(dtmfResult);
                return { success: true, data: undefined };
            }

            // If no DTMF, process for voice
            const voiceResult = await this.voiceDetector.analyze(input);
            if (voiceResult) {
                logger.debug('Voice segment detected', {
                    duration: voiceResult.endTime - voiceResult.startTime
                });
                await this.handleVoice(voiceResult);
            }

            this.status.processedFrames++;
            return { success: true, data: undefined };

        } catch (error) {
            this.status.metrics.errors++;
            const err = error instanceof Error ? error : new Error(String(error));
            logger.error('Error processing audio:', err);
            this.emit('error', err);
            return { success: false, error: err };
        } finally {
            this.status.isProcessing = false;
            this.status.lastProcessingTime = Date.now() - startTime;
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
            this.status.metrics.errors++;
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
            this.status.metrics.errors++;
            logger.error('Error in voice handler:', error);
            this.emit('error', error);
        }
    }

    public addHandler(eventType: 'dtmf' | 'voice', handler: EventHandler): void {
        logger.debug('Adding audio handler', { eventType });
        
        // Get or create handler array for this event type
        const handlers = this.handlers.get(eventType) || [];
        handlers.push(handler);
        this.handlers.set(eventType, handlers);
    }

    public removeHandler(eventType: 'dtmf' | 'voice', handler: EventHandler): void {
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

    public getStatus(): PipelineStatus {
        // Update uptime
        this.status.metrics.uptime = process.uptime();
        this.status.metrics.lastChecked = new Date();
        return { ...this.status };
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

            // Update status
            this.status.isInitialized = false;
            this.status.isHealthy = false;

            logger.info('Audio pipeline shutdown complete');
        } catch (error) {
            logger.error('Error during audio pipeline shutdown:', error);
            throw error;
        }
    }
}