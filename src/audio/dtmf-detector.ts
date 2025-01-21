// src/audio/dtmf-detector.ts
//
// This file implements DTMF (Dual-Tone Multi-Frequency) tone detection
// for telephone keypad input. It uses the Goertzel algorithm to detect
// specific frequencies that represent different keys.

import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import { AudioInput, DTMFEvent } from '../types';

// DTMF frequency pairs for each digit
const DTMF_FREQUENCIES = {
    '1': { low: 697, high: 1209 },
    '2': { low: 697, high: 1336 },
    '3': { low: 697, high: 1477 },
    '4': { low: 770, high: 1209 },
    '5': { low: 770, high: 1336 },
    '6': { low: 770, high: 1477 },
    '7': { low: 852, high: 1209 },
    '8': { low: 852, high: 1336 },
    '9': { low: 852, high: 1477 },
    '*': { low: 941, high: 1209 },
    '0': { low: 941, high: 1336 },
    '#': { low: 941, high: 1477 }
};

interface DTMFConfig {
    sampleRate: number;
    minDuration?: number;  // Minimum duration for valid tone (ms)
    energyThreshold?: number;  // Energy threshold for detection
    bufferSize?: number;  // Size of processing buffer
}

export class DTMFDetector extends EventEmitter {
    private readonly config: Required<DTMFConfig>;
    private currentBuffer: Float32Array;
    private lastDetectedDigit: string | null = null;
    private detectionStartTime: number = 0;
    private isProcessing: boolean = false;

    constructor(config: DTMFConfig) {
        super();
        
        // Set default configuration values
        this.config = {
            minDuration: 40,  // 40ms minimum for valid tone
            energyThreshold: 0.005,  // Adjust based on your audio input
            bufferSize: 512,  // Processing buffer size
            ...config
        };

        this.currentBuffer = new Float32Array(this.config.bufferSize);
    }

    public async analyze(input: AudioInput): Promise<DTMFEvent | null> {
        if (this.isProcessing) {
            return null;
        }

        try {
            this.isProcessing = true;

            // Convert input buffer to float32 array for processing
            const audioData = this.normalizeAudio(input.data);
            
            // Run Goertzel algorithm for each DTMF frequency pair
            const detectedDigit = this.detectDTMFTone(audioData);

            if (detectedDigit) {
                const event = this.createDTMFEvent(detectedDigit);
                if (event) {
                    this.emit('dtmf', event);
                    return event;
                }
            } else {
                this.resetDetection();
            }

            return null;

        } catch (error) {
            logger.error('Error in DTMF detection:', error);
            throw error;
        } finally {
            this.isProcessing = false;
        }
    }

    private normalizeAudio(buffer: Buffer): Float32Array {
        // Convert 16-bit PCM to float32 (-1 to 1)
        const samples = new Float32Array(buffer.length / 2);
        for (let i = 0; i < samples.length; i++) {
            samples[i] = buffer.readInt16LE(i * 2) / 32768.0;
        }
        return samples;
    }

    private detectDTMFTone(samples: Float32Array): string | null {
        let maxEnergy = 0;
        let detectedDigit: string | null = null;

        // Check each DTMF digit's frequency pair
        for (const [digit, frequencies] of Object.entries(DTMF_FREQUENCIES)) {
            const lowEnergy = this.goertzel(samples, frequencies.low);
            const highEnergy = this.goertzel(samples, frequencies.high);
            
            // Calculate combined energy
            const energy = Math.sqrt(lowEnergy * highEnergy);

            // Update if this is the strongest detection
            if (energy > maxEnergy && energy > this.config.energyThreshold) {
                maxEnergy = energy;
                detectedDigit = digit;
            }
        }

        return detectedDigit;
    }

    private goertzel(samples: Float32Array, targetFrequency: number): number {
        // Goertzel algorithm implementation
        // Efficiently detects specific frequency components
        const omega = 2 * Math.PI * targetFrequency / this.config.sampleRate;
        const coeff = 2 * Math.cos(omega);
        
        let q0 = 0, q1 = 0, q2 = 0;

        // Process each sample
        for (let i = 0; i < samples.length; i++) {
            q0 = coeff * q1 - q2 + samples[i];
            q2 = q1;
            q1 = q0;
        }

        // Calculate energy
        return q1 * q1 + q2 * q2 - coeff * q1 * q2;
    }

    private createDTMFEvent(digit: string): DTMFEvent | null {
        const now = Date.now();

        // If this is a new detection, start timing
        if (this.lastDetectedDigit !== digit) {
            this.lastDetectedDigit = digit;
            this.detectionStartTime = now;
            return null;
        }

        // Check if tone has been held long enough
        const duration = now - this.detectionStartTime;
        if (duration >= this.config.minDuration) {
            return {
                digit,
                duration,
                timestamp: now
            };
        }

        return null;
    }

    private resetDetection(): void {
        this.lastDetectedDigit = null;
        this.detectionStartTime = 0;
    }

    public clear(): void {
        this.resetDetection();
        this.currentBuffer = new Float32Array(this.config.bufferSize);
        this.isProcessing = false;
    }

    public shutdown(): void {
        this.clear();
        this.removeAllListeners();
    }
}