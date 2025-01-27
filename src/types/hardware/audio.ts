// src/types/hardware/audio.ts

import { Buffer } from 'buffer';
import { HardwareError } from './dahdi';

export type AudioBuffer = Buffer;

export interface AudioConfig {
    sampleRate: 8000;
    channels: 1;
    bitDepth: 16;
    vadThreshold: number;
    silenceThreshold: number;
    bufferSize?: number;
}

export interface AudioInput {
    sampleRate: number;
    channels: number;
    bitDepth: number;
    data: Buffer;
    format?: string;
}

export interface AudioOutput {
    sampleRate: number;
    channels: number;
    bitDepth: number;
    data: Buffer;
    metadata?: Record<string, any>;
}

export interface DTMFEvent {
    digit: string;
    duration: number;
    timestamp: number;
    strength?: number;
}

export interface VoiceEvent {
    audio: Buffer;
    startTime: number;
    endTime: number;
    isFinal: boolean;
    confidence?: number;
}

export interface AudioFormat {
    sampleRate: number;
    channels: number;
    bitDepth: number;
    format?: 'linear' | 'alaw' | 'ulaw';
    encoding?: string;
}

export function isValidAudioFormat(format: Partial<AudioFormat>): format is AudioFormat {
    return (
        typeof format.sampleRate === 'number' &&
        typeof format.channels === 'number' &&
        typeof format.bitDepth === 'number' &&
        (!format.format || ['linear', 'alaw', 'ulaw'].includes(format.format))
    );
}

/**
 * Audio processing errors
 */
export class AudioError extends HardwareError {
    constructor(message: string, details?: Record<string, any>) {
        super(message, { ...details, source: 'AUDIO' });
    }
}

/**
 * Audio format validation errors
 */
export class AudioFormatError extends AudioError {
    constructor(message: string, details?: string[]) {
        super(message, { invalidFormats: details });
    }
}