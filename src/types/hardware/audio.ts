// src/types/hardware/audio.ts

import { Buffer } from 'buffer';

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