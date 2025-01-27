// src/types/services/ai.ts

export interface AIConfig {
    anthropicKey: string;
    elevenLabsKey?: string;
    openAIKey?: string;
    maxTokens?: number;
    temperature?: number;
    voiceId?: string;
    model?: string;
}

export interface AIService {
    initialize(): Promise<void>;
    processText(text: string): Promise<string>;
    processVoice(audioBuffer: Buffer): Promise<string>;
    generateSpeech(text: string): Promise<Buffer>;
    processTextStreaming(text: string, callback: (chunk: string) => void): Promise<void>;
    updateContext(key: string, value: any): Promise<void>;
    getStatus(): Promise<AIServiceStatus>;
    shutdown(): Promise<void>;
}

export interface AIServiceStatus {
    isReady: boolean;
    model: string;
    context?: Record<string, any>;
    lastProcessed?: Date;
}