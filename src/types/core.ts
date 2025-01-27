import { Buffer } from 'buffer';

// ===== Core Result Types =====

export interface Result<T, E = Error> {
    success: boolean;
    data?: T;
    error?: E;
    metadata?: Record<string, unknown>;
}

// ===== Configuration Types =====

export interface AppConfig {
    name: string;
    env: 'development' | 'production' | 'test';
    port: number;
}

export interface HardwareConfig {
    dahdi: {
        device: string;
        span: number;
        channel: number;
        loadzone: string;
        defaultzone: string;
        echocancel: boolean;
        echocanceltaps: number;
        bufferSize: number;
        ringTimeout: number;
        dtmfTimeout: number;
    };
    audio: {
        sampleRate: 8000;
        channels: 1;
        bitDepth: 16;
        vadThreshold: number;
        silenceThreshold: number;
    };
}

export interface AIConfig {
    anthropicKey: string;
    elevenLabsKey: string;
    openAIKey: string;
    maxTokens: number;
    temperature: number;
    voiceId: string;
    model?: string;
}

export interface MusicConfig {
    spotifyClientId?: string;
    spotifyClientSecret?: string;
}

export interface HomeConfig {
    homekitBridge: {
        pin: string;
        name: string;
        port: number;
    };
}

export interface LogConfig {
    level: 'debug' | 'info' | 'warn' | 'error';
    directory: string;
    maxFiles: string;
    maxSize: string;
}

export interface ServiceConfig {
    app: AppConfig;
    hardware: HardwareConfig;
    ai: AIConfig;
    music: MusicConfig;
    home: HomeConfig;
    logging: LogConfig;
}

// ===== Hardware States =====

export enum HardwareState {
    INITIALIZING = 'initializing',
    READY = 'ready',
    ERROR = 'error',
    OFFLINE = 'offline'
}

export enum PhoneState {
    IDLE = 'idle',
    OFF_HOOK = 'off_hook',
    RINGING = 'ringing',
    IN_CALL = 'in_call',
    ERROR = 'error'
}

// ===== Event Types =====

export interface BaseEvent {
    type: string;
    timestamp: number;
    metadata?: Record<string, unknown>;
}

export interface HardwareEvent extends BaseEvent {
    type: 'hardware';
    status: HardwareState;
    details?: Record<string, unknown>;
}

export interface ServiceEvent extends BaseEvent {
    type: 'service';
    service: string;
    status: 'started' | 'stopped' | 'error';
    details?: Record<string, unknown>;
}

// ===== Command Types =====

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

// ===== Diagnostic Types =====

export interface DiagnosticResult {
    test: string;
    passed: boolean;
    message?: string;
    details?: Record<string, unknown>;
    timestamp?: number;
}

// Export all error types from errors.ts
export * from './errors';

// Export hardware-specific types
export * from './hardware/audio';
export * from './hardware/dahdi';
export * from './hardware/fxs';
