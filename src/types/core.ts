import { Buffer } from 'buffer';
import { LOG_LEVELS } from '../config/constants';

// Core result and error types
export interface Result<T, E = Error> {
    success: boolean;
    data?: T;
    error?: E;
    metadata?: Record<string, unknown>;
}

// Base configuration and status interfaces
export interface BaseConfig {
    enabled?: boolean;
    retryAttempts?: number;
    timeout?: number;
}

export interface HardwareConfig {
    dahdi: {
        devicePath: string;
        sampleRate: 8000;
        channel: {
            number: number;
            ringCadence: [number, number];
            callerIdFormat: 'bell' | 'v23' | 'dtmf';
            impedance: 600 | 900;
            gain: {
                rx: number;
                tx: number;
            };
        };
        audio: {
            echoCancellation: {
                enabled: boolean;
                taps: number;
                nlp: boolean;
            };
            gainControl: {
                enabled: boolean;
                targetLevel: number;
                maxGain: number;
            };
            dtmfDetection: {
                useHardware: boolean;
                minDuration: number;
                threshold: number;
            };
        };
        debug?: {
            logHardware: boolean;
            logAudio: boolean;
            traceDahdi: boolean;
        };
    };
    audio: {
        sampleRate: number;
        channels: number;
        bitDepth: number;
        vadThreshold: number;
        silenceThreshold: number;
    };
}

export interface BaseStatus {
    isHealthy: boolean;
    lastError?: Error;
    metadata?: Record<string, unknown>;
}

// Event system types
export interface BaseEvent {
    type: string;
    timestamp: number;
    metadata?: Record<string, unknown>;
}

// Command system types
export type CommandStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface Command {
    type: string;
    id: string;
    status: CommandStatus;
    timestamp: number;
    metadata?: Record<string, unknown>;
}

export interface CommandResult<T> extends Result<T> {
    command: Command;
    duration: number;
}

// Diagnostic types
export interface DiagnosticResult {
    test: string;
    passed: boolean;
    message?: string;
    details?: Record<string, unknown>;
    timestamp?: number;
}

// Logging types
export type LogLevel = typeof LOG_LEVELS[number];

// Re-export hardware types
export * from './hardware';
