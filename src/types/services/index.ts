// src/types/services/index.ts

export * from './ai';
export * from './home';
export * from './music';

export interface ServiceConfig {
    ai: AIConfig;
    home: HomeConfig;
    music: MusicConfig;
}

// Common service interfaces moved from core.ts
export interface AudioConfig {
    sampleRate: number;
    channels: number;
    bitDepth: number;
    bufferSize: number;
}

export interface AIServiceConfig {
    model: string;
    apiKey: string;
    maxTokens?: number;
}

export interface MusicServiceConfig {
    provider: 'spotify' | 'local';
    apiKey?: string;
    directory?: string;
}

export interface HomeServiceConfig {
    url: string;
    token: string;
    entityPrefix?: string;
}
