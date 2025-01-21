// src/audio/types.ts
export interface AudioInput {
    sampleRate: number;
    channels: number;
    bitDepth: number;
    data: Buffer;
}

export interface DTMFEvent {
    digit: string;
    duration: number;
    timestamp: number;
}

export interface VoiceEvent {
    audio: Buffer;
    startTime: number;
    endTime: number;
    isFinal: boolean;
}

export type AudioEventHandler = (event: DTMFEvent | VoiceEvent) => Promise<void>;

// src/audio/pipeline.ts
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
        this.dtmfDetector = new DTMFDetector();
        this.voiceDetector = new VoiceDetector();

        // Setup internal event handlers
        this.dtmfDetector.on('dtmf', this.handleDTMF.bind(this));
        this.voiceDetector.on('voice', this.handleVoice.bind(this));
    }

    public async processAudio(input: AudioInput): Promise<void> {
        if (this.isProcessing) {
            logger.warn('Audio pipeline is busy, dropping frame');
            return;
        }

        try {
            this.isProcessing = true;

            // Process for DTMF tones
            const dtmfResult = await this.dtmfDetector.analyze(input);
            if (dtmfResult) {
                await this.handleDTMF(dtmfResult);
                return; // Don't process voice if DTMF detected
            }

            // Process for voice
            const voiceResult = await this.voiceDetector.analyze(input);
            if (voiceResult) {
                await this.handleVoice(voiceResult);
            }

        } catch (error) {
            logger.error('Error processing audio:', error);
            this.emit('error', error);
        } finally {
            this.isProcessing = false;
        }
    }

    public addHandler(eventType: 'dtmf' | 'voice', handler: AudioEventHandler): void {
        const handlers = this.handlers.get(eventType) || [];
        handlers.push(handler);
        this.handlers.set(eventType, handlers);
    }

    private async handleDTMF(event: DTMFEvent): Promise<void> {
        const handlers = this.handlers.get('dtmf') || [];
        try {
            await Promise.all(handlers.map(handler => handler(event)));
            this.emit('dtmf', event);
        } catch (error) {
            logger.error('Error handling DTMF event:', error);
            this.emit('error', error);
        }
    }

    private async handleVoice(event: VoiceEvent): Promise<void> {
        const handlers = this.handlers.get('voice') || [];
        try {
            await Promise.all(handlers.map(handler => handler(event)));
            this.emit('voice', event);
        } catch (error) {
            logger.error('Error handling voice event:', error);
            this.emit('error', error);
        }
    }

    public shutdown(): void {
        this.dtmfDetector.shutdown();
        this.voiceDetector.shutdown();
        this.removeAllListeners();
        this.handlers.clear();
    }
}

// Example usage:
import { AudioPipeline } from './audio/pipeline';

async function setupAudioPipeline() {
    const pipeline = new AudioPipeline();

    // Add DTMF handler
    pipeline.addHandler('dtmf', async (event) => {
        const dtmfEvent = event as DTMFEvent;
        console.log(`DTMF digit detected: ${dtmfEvent.digit}`);
    });

    // Add voice handler
    pipeline.addHandler('voice', async (event) => {
        const voiceEvent = event as VoiceEvent;
        console.log(`Voice detected: ${voiceEvent.startTime} - ${voiceEvent.endTime}`);
    });

    // Process incoming audio
    const audioInput: AudioInput = {
        sampleRate: 8000,
        channels: 1,
        bitDepth: 16,
        data: Buffer.from([/* audio data */])
    };

    await pipeline.processAudio(audioInput);
}