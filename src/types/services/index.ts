// src/types/services/index.ts

export * from './ai';
export * from './home';
export * from './music';

export interface ServiceConfig {
    ai: AIConfig;
    home: HomeConfig;
    music: MusicConfig;
}

// Service status interface
export interface ServiceStatus {
    isHealthy: boolean;
    state: string;
    lastError?: Error;
    metadata?: Record<string, any>;
}

// Base config interface
export interface BaseServiceConfig {
    enabled: boolean;
    retryAttempts?: number;
    timeout?: number;
}

// Refined service configs
export interface AudioConfig extends BaseServiceConfig {
    sampleRate: number;
    channels: number;
    bitDepth: number;
    bufferSize: number;
}

export interface AIServiceConfig extends BaseServiceConfig {
    model: string;
    apiKey: string;
    maxTokens?: number;
    temperature?: number;
}

export interface MusicServiceConfig extends BaseServiceConfig {
    provider: 'spotify' | 'local';
    apiKey?: string;
    directory?: string;
}

export interface HomeServiceConfig extends BaseServiceConfig {
    url: string;
    token: string;
    entityPrefix?: string;
}
