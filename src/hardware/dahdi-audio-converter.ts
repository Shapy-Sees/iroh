// src/hardware/dahdi-audio-converter.ts
//
// Audio format conversion utilities for DAHDI interface
// Handles conversion between different audio formats to ensure
// compatibility with DAHDI's requirements of 8kHz/16-bit/mono.
// Uses Web Audio API's AudioBuffer for format handling and implements
// custom resampling for optimal quality.

import { EventEmitter } from 'events';
import { AudioBuffer } from 'audiobuffer-to-wav';
import { logger } from '../utils/logger';
import { 
    DAHDIAudioFormat, 
    AudioFormatError,
    AudioInput 
} from '../types/dahdi';
import { AudioError } from '../types/audio';
import { DAHDIError } from '../types/dahdi';

interface AudioConverterOptions {
    /** Buffer size for processing */
    bufferSize?: number;
    /** Whether to use worker threads for conversion */
    useWorkers?: boolean;
}

export class DAHDIAudioConverter extends EventEmitter {
    private readonly options: Required<AudioConverterOptions>;
    private isProcessing: boolean = false;

    constructor(options?: AudioConverterOptions) {
        super();
        this.options = {
            bufferSize: 2048,
            useWorkers: false,
            ...options
        };
        
        logger.debug('Initializing DAHDI audio converter', { options: this.options });
    }

    /**
     * Converts audio buffer to DAHDI format (8kHz/16-bit/mono)
     */
    public async convertToDAHDI(
        buffer: Buffer,
        sourceFormat: Partial<DAHDIAudioFormat>
    ): Promise<Buffer> {
        try {
            if (this.isProcessing) {
                throw new AudioFormatError('Converter busy', ['Resource busy']);
            }
            
            this.isProcessing = true;
            logger.debug('Starting audio conversion to DAHDI format', {
                sourceFormat,
                bufferSize: buffer.length
            });

            // Convert input buffer to AudioBuffer for processing
            let audioBuffer = await this.bufferToAudioBuffer(buffer, sourceFormat);

            // Resample if needed
            if (sourceFormat.sampleRate !== 8000) {
                audioBuffer = await this.resampleAudioBuffer(audioBuffer, 8000);
            }

            // Convert to mono if needed
            if (audioBuffer.numberOfChannels > 1) {
                audioBuffer = this.convertToMono(audioBuffer);
            }

            // Convert to 16-bit PCM buffer
            const output = await this.audioBufferToInt16Buffer(audioBuffer);

            logger.debug('Audio conversion completed', {
                inputSize: buffer.length,
                outputSize: output.length,
                sampleRate: audioBuffer.sampleRate,
                channels: audioBuffer.numberOfChannels
            });

            return output;

        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            logger.error('Audio conversion failed:', err);
            throw new AudioFormatError('Audio conversion failed', [err.message]);
        } finally {
            this.isProcessing = false;
        }
    }

    /**
     * Converts Buffer to AudioBuffer for processing
     */
    private async bufferToAudioBuffer(
        buffer: Buffer,
        format: Partial<DAHDIAudioFormat>
    ): Promise<AudioBuffer> {
        const channels = format.channels || 1;
        const sampleRate = format.sampleRate || 8000;
        const samplesPerChannel = buffer.length / (channels * (format.bitDepth || 16) / 8);

        const audioBuffer = new AudioBuffer({
            length: samplesPerChannel,
            numberOfChannels: channels,
            sampleRate: sampleRate
        });

        // Convert buffer data to float32 samples
        for (let channel = 0; channel < channels; channel++) {
            const channelData = new Float32Array(samplesPerChannel);
            for (let i = 0; i < samplesPerChannel; i++) {
                const offset = (i * channels + channel) * 2;
                channelData[i] = buffer.readInt16LE(offset) / 32768.0;
            }
            audioBuffer.copyToChannel(channelData, channel);
        }

        return audioBuffer;
    }

    /**
     * Resamples AudioBuffer to target sample rate using linear interpolation
     */
    private async resampleAudioBuffer(
        buffer: AudioBuffer,
        targetRate: number
    ): Promise<AudioBuffer> {
        const ratio = buffer.sampleRate / targetRate;
        const newLength = Math.floor(buffer.length / ratio);
        
        const resampled = new AudioBuffer({
            length: newLength,
            numberOfChannels: buffer.numberOfChannels,
            sampleRate: targetRate
        });

        // Resample each channel
        for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
            const input = buffer.getChannelData(channel);
            const output = new Float32Array(newLength);

            for (let i = 0; i < newLength; i++) {
                const position = i * ratio;
                const index = Math.floor(position);
                const fraction = position - index;

                // Linear interpolation
                const current = input[index] || 0;
                const next = input[index + 1] || current;
                output[i] = current + fraction * (next - current);
            }

            resampled.copyToChannel(output, channel);
        }

        return resampled;
    }

    /**
     * Converts multi-channel AudioBuffer to mono
     */
    private convertToMono(buffer: AudioBuffer): AudioBuffer {
        const mono = new AudioBuffer({
            length: buffer.length,
            numberOfChannels: 1,
            sampleRate: buffer.sampleRate
        });

        // Mix all channels to mono
        const monoData = new Float32Array(buffer.length);
        for (let i = 0; i < buffer.numberOfChannels; i++) {
            const channelData = buffer.getChannelData(i);
            for (let j = 0; j < buffer.length; j++) {
                monoData[j] += channelData[j] / buffer.numberOfChannels;
            }
        }

        mono.copyToChannel(monoData, 0);
        return mono;
    }

    /**
     * Converts AudioBuffer to 16-bit PCM Buffer
     */
    private async audioBufferToInt16Buffer(buffer: AudioBuffer): Promise<Buffer> {
        const float32Array = buffer.getChannelData(0);
        const output = Buffer.alloc(float32Array.length * 2);

        for (let i = 0; i < float32Array.length; i++) {
            // Clamp values to -1 to 1 range
            const sample = Math.max(-1, Math.min(1, float32Array[i]));
            // Convert to 16-bit integer
            const value = Math.floor(sample < 0 ? sample * 0x8000 : sample * 0x7FFF);
            output.writeInt16LE(value, i * 2);
        }

        return output;
    }

    public destroy(): void {
        this.removeAllListeners();
    }
}