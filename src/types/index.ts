// src/types/index.ts
//
// Key Features:
// - Core type definitions for the entire project
// - Interface definitions for all services
// - Type definitions for hardware interactions
// - Event type definitions
// - Configuration interface definitions

// Audio Processing Types
export interface AudioInput {
    sampleRate: number;
    channels: number;
    bitDepth: number;
    data: Buffer;
}

export interface VoiceEvent {
    audio: Buffer;
    startTime: number;
    endTime: number;
    isFinal: boolean;
}

export interface DTMFEvent {
    digit: string;
    duration: number;
    timestamp: number;
}

// Service Interfaces
export interface AudioService {
    processAudio(input: AudioInput): Promise<void>;
    shutdown(): void;
}

export interface AIService {
    processText(text: string): Promise<string>;
    processVoice(audioBuffer: Buffer): Promise<string>;
    generateSpeech(text: string): Promise<Buffer>;
    shutdown(): void;
}

export interface MusicService {
    play(query: string): Promise<void>;
    pause(): Promise<void>;
    next(): Promise<void>;
    previous(): Promise<void>;
    setVolume(level: number): Promise<void>;
    getStatus(): Promise<MusicStatus>;
}

export interface HomeService {
    executeCommand(command: string): Promise<void>;
    getStatus(): Promise<HomeStatus>;
    getDeviceState(deviceId: string): Promise<DeviceState>;
    setDeviceState(deviceId: string, state: DeviceState): Promise<void>;
}

// Status Types
export interface MusicStatus {
    isPlaying: boolean;
    currentTrack?: {
        title: string;
        artist: string;
        duration: number;
    };
    volume: number;
    queue: number;
}

export interface HomeStatus {
    devices: DeviceState[];
    scenes: SceneState[];
}

export interface DeviceState {
    id: string;
    name: string;
    type: string;
    state: any;
    batteryLevel?: number;
    reachable: boolean;
}

export interface SceneState {
    id: string;
    name: string;
    active: boolean;
}

// Configuration Types
export interface Config {
    app: AppConfig;
    audio: AudioConfig;
    ai: AIConfig;
    music: MusicConfig;
    home: HomeConfig;
    logging: LogConfig;
}

export interface AppConfig {
    name: string;
    env: 'development' | 'production' | 'test';
    port: number;
}

export interface AudioConfig {
    sampleRate: number;
    channels: number;
    bitDepth: number;
    vadThreshold: number;
    silenceThreshold: number;
}

export interface AIConfig {
    anthropicKey: string;
    elevenLabsKey: string;
    openAIKey: string;
    maxTokens: number;
    temperature: number;
    voiceId: string;
}

export interface MusicConfig {
    spotifyClientId?: string;
    spotifyClientSecret?: string;
    appleMusicKey?: string;
    sonosClientId?: string;
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

// Error Types
export class IrohError extends Error {
    constructor(message: string, public code: string) {
        super(message);
        this.name = 'IrohError';
    }
}

export class HardwareError extends IrohError {
    constructor(message: string) {
        super(message, 'HARDWARE_ERROR');
        this.name = 'HardwareError';
    }
}

export class ServiceError extends IrohError {
    constructor(message: string) {
        super(message, 'SERVICE_ERROR');
        this.name = 'ServiceError';
    }
}

export interface PhoneControllerConfig {
    fxs: {
        devicePath: string;
        sampleRate: number;
    };
    audio: {
        bufferSize: number;
        channels: number;
        bitDepth: number;
    };
    ai: {
        // Add appropriate AI configuration properties
        model?: string;
        apiKey?: string;
        // ... other AI-specific config
    };
}