// src/types/services/ai.ts

export interface AIConfig {
    anthropicKey: string;
    elevenLabsKey?: string;
    openAIKey?: string;
    maxTokens?: number;
    temperature?: number;
    voiceId?: string;
}

export interface AIService {
    initialize(): Promise<void>;
    processText(text: string): Promise<string>;
    processVoice(audioBuffer: Buffer): Promise<string>;
    generateSpeech(text: string): Promise<Buffer>;
    processTextStreaming(text: string): Promise<void>;
    updateContext(key: string, value: any): Promise<void>;
    shutdown(): Promise<void>;
}