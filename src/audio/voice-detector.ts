// src/audio/voice-detector.ts
//
// This file implements Voice Activity Detection (VAD) to:
// - Detect when someone is speaking
// - Handle continuous audio streaming
// - Manage audio buffering
// - Provide speech segments for processing
// - Filter out silence and background noise

import { EventEmitter } from 'events';
import { AudioInput, VoiceEvent } from '../types';
import { logger } from '../utils/logger';

interface VADOptions {
    sampleRate?: number;
    frameDuration?: number;
    vadThreshold?: number;
    silenceThreshold?: number;
    maxSpeechDuration?: number;
    minSpeechDuration?: number;
}

export class VoiceDetector extends EventEmitter {
    private readonly options: Required<VADOptions>;
    private buffer: Float32Array[];
    private isRecording: boolean;
    private speechStartTime: number;
    private lastVoiceTime: number;
    private readonly frameSize: number;
    private readonly energyHistory: number[];
    private readonly energyHistorySize: number = 30; // 30 frames of history

    constructor(options?: VADOptions) {
        super();
        
        // Set default options
        this.options = {
            sampleRate: 16000,
            frameDuration: 30,        // ms
            vadThreshold: 0.015,      // Energy threshold for voice detection
            silenceThreshold: 500,    // ms of silence to mark end of speech
            maxSpeechDuration: 10000, // 10 seconds maximum
            minSpeechDuration: 100,   // 100ms minimum
            ...options
        };

        // Calculate frame size based on sample rate and frame duration
        this.frameSize = Math.floor(this.options.sampleRate * (this.options.frameDuration / 1000));
        
        // Initialize state
        this.buffer = [];
        this.isRecording = false;
        this.speechStartTime = 0;
        this.lastVoiceTime = 0;
        this.energyHistory = [];
    }

    public async analyze(input: AudioInput): Promise<VoiceEvent | null> {
        try {
            // Convert input to float32 array
            const audioData = this.convertToFloat32(input.data);
            
            // Calculate frame energy
            const energy = this.calculateEnergy(audioData);
            this.updateEnergyHistory(energy);

            // Detect voice activity
            const isVoice = this.detectVoice(energy);
            const currentTime = Date.now();

            if (isVoice) {
                this.lastVoiceTime = currentTime;
                
                if (!this.isRecording) {
                    this.startRecording(currentTime);
                }
                
                this.buffer.push(audioData);
                
                // Check for maximum duration
                if (currentTime - this.speechStartTime >= this.options.maxSpeechDuration) {
                    return this.finalizeRecording(currentTime);
                }
            } else if (this.isRecording) {
                this.buffer.push(audioData);
                
                // Check for silence duration
                if (currentTime - this.lastVoiceTime >= this.options.silenceThreshold) {
                    return this.finalizeRecording(currentTime);
                }
            }

            return null;

        } catch (error) {
            logger.error('Error in voice detection:', error);
            throw error;
        }
    }

    private convertToFloat32(buffer: Buffer): Float32Array {
        const samples = new Float32Array(buffer.length / 2);
        for (let i = 0; i < samples.length; i++) {
            samples[i] = buffer.readInt16LE(i * 2) / 32768.0;
        }
        return samples;
    }

    private calculateEnergy(samples: Float32Array): number {
        let sum = 0;
        for (let i = 0; i < samples.length; i++) {
            sum += samples[i] * samples[i];
        }
        return Math.sqrt(sum / samples.length);
    }

    private updateEnergyHistory(energy: number): void {
        this.energyHistory.push(energy);
        if (this.energyHistory.length > this.energyHistorySize) {
            this.energyHistory.shift();
        }
    }

    private detectVoice(currentEnergy: number): boolean {
        // Get average background energy
        const avgEnergy = this.energyHistory.reduce((sum, e) => sum + e, 0) / 
                         this.energyHistory.length;

        // Dynamic threshold based on background noise
        const dynamicThreshold = Math.max(
            this.options.vadThreshold,
            avgEnergy * 2
        );

        return currentEnergy > dynamicThreshold;
    }

    private startRecording(startTime: number): void {
        this.isRecording = true;
        this.speechStartTime = startTime;
        this.buffer = [];
        logger.debug('Started voice recording');
    }

    private finalizeRecording(endTime: number): VoiceEvent | null {
        const duration = endTime - this.speechStartTime;
        
        // Ignore if speech is too short
        if (duration < this.options.minSpeechDuration) {
            this.resetRecording();
            return null;
        }

        // Combine all buffers
        const totalSamples = this.buffer.reduce((sum, buf) => sum + buf.length, 0);
        const combinedBuffer = new Float32Array(totalSamples);
        
        let offset = 0;
        for (const buffer of this.buffer) {
            combinedBuffer.set(buffer, offset);
            offset += buffer.length;
        }

        // Convert to 16-bit PCM
        const audioBuffer = Buffer.alloc(combinedBuffer.length * 2);
        for (let i = 0; i < combinedBuffer.length; i++) {
            const sample = Math.max(-1, Math.min(1, combinedBuffer[i]));
            const value = Math.floor(sample < 0 ? sample * 0x8000 : sample * 0x7FFF);
            audioBuffer.writeInt16LE(value, i * 2);
        }

        const event: VoiceEvent = {
            audio: audioBuffer,
            startTime: this.speechStartTime,
            endTime,
            isFinal: true
        };

        this.resetRecording();
        this.emit('voice', event);
        
        logger.debug(`Finalized voice recording: ${duration}ms`);
        return event;
    }

    private resetRecording(): void {
        this.isRecording = false;
        this.buffer = [];
        this.speechStartTime = 0;
        this.lastVoiceTime = 0;
    }

    public shutdown(): void {
        this.resetRecording();
        this.removeAllListeners();
    }
}