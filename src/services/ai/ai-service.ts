// src/services/ai/ai-service.ts
//
// AI service implementation that handles:
// - Text processing with Anthropic's Claude API
// - Speech synthesis (placeholder for ElevenLabs integration)
// - Streaming responses
// - Error handling and logging
// - Cache management

import { Anthropic } from '@anthropic-ai/sdk';
import { EventEmitter } from 'events';
import { logger } from '../../utils/logger';
import { ConversationManager } from './conversation-manager';
import { Cache } from '../../utils/cache';
import { IrohAIService as IIrohAIService, ServiceStatus, ServiceError } from '../../types/services';
import { AIConfig } from '../../types/core';
import { Service, ServiceState } from '../../types/services';
import { AudioBuffer } from '../../types/hardware/audio';

// Define the base interface
export interface AIService {
    initialize(): Promise<void>;
    generateSpeech(text: string): Promise<Buffer>;
    shutdown(): Promise<void>;
    processText(text: string): Promise<string>;
    processVoice(audio: Buffer): Promise<string>;
}

export interface AIServiceConfig {
    anthropicKey: string;
    elevenLabsKey?: string;
    maxTokens?: number;
    temperature?: number;
    voiceId?: string;
}

interface StreamingConfig {
    textChunkSize: number;      // Characters per text chunk
    audioChunkSize: number;     // Bytes per audio chunk
    maxStreamDuration: number;  // Maximum streaming duration in ms
}

interface AIServiceEvents {
    textChunk: (text: string) => void;
    streamComplete: () => void;
    streamPause: () => void;
    streamResume: () => void;
    streamStop: () => void;
    error: (error: ServiceError) => void;
}

export class IrohAIService extends EventEmitter implements IIrohAIService, Service {
    private client: Anthropic;
    private isInitialized: boolean = false;
    public readonly config: AIConfig;
    private streamingConfig: StreamingConfig;
    private cache: Cache;
    private conversationManager: ConversationManager;
    private serviceStatus: ServiceStatus;

    constructor(private config: AIServiceConfig) {
        super();
        this.serviceStatus = {
            state: 'initializing' as ServiceState,
            isHealthy: false,
            lastUpdate: new Date()
        };
        
        // Initialize Anthropic client
        this.client = new Anthropic({
            apiKey: config.anthropicKey
        });
        
        // Initialize streaming config
        this.streamingConfig = {
            textChunkSize: 100,
            audioChunkSize: 4096,
            maxStreamDuration: 30000
        };

        // Initialize cache
        this.cache = new Cache({
            namespace: 'ai-responses',
            ttl: 1 * 60 * 60 * 1000  // 1 hour
        });

        // Initialize conversation manager
        this.conversationManager = new ConversationManager();
    }

    public async initialize(): Promise<void> {
        try {
            // Validate configuration
            if (!this.config.anthropicKey) {
                throw new Error('Anthropic API key is required');
            }

            this.isInitialized = true;
            this.serviceStatus.state = 'ready';
            this.serviceStatus.isHealthy = true;
            this.serviceStatus.lastUpdate = new Date();
            logger.info('AI Service initialized');
        } catch (error) {
            this.serviceStatus.state = 'error';
            this.serviceStatus.isHealthy = false;
            this.serviceStatus.lastError = error instanceof Error ? error : new Error(String(error));
            this.serviceStatus.lastUpdate = new Date();
            logger.error('Failed to initialize AI Service:', error instanceof Error ? error : new Error(String(error)));
            throw error;
        }
    }

    public async generateSpeech(text: string): Promise<AudioBuffer> {
        try {
            // This is a placeholder implementation
            // In a real implementation, this would integrate with ElevenLabs or another TTS service
            logger.info('Generating speech', { textLength: text.length });
            
            // Return a dummy buffer for now
            return Buffer.from('Audio placeholder');
        } catch (error) {
            logger.error('Failed to generate speech:', error instanceof Error ? error : new Error(String(error)));
            throw error;
        }
    }

    public async processText(text: string): Promise<string> {
        try {
            // Check cache first
            const cacheKey = `text:${text}`;
            const cached = await this.cache.get<string>(cacheKey);
            if (cached) {
                logger.debug('Cache hit for text processing');
                return cached;
            }

            logger.info('Processing text with Claude', { textLength: text.length });

            const response = await this.client.messages.create({
                model: 'claude-3-opus-20240229',
                max_tokens: this.config.maxTokens || 1024,
                temperature: this.config.temperature || 0.7,
                messages: [{
                    role: 'user',
                    content: text
                }],
                system: `You are Iroh, a wise and kind AI assistant accessed through a vintage telephone. 
                        You provide thoughtful advice and help control smart home features.`
            });

            const result = response.content[0].text;

            // Cache the response
            await this.cache.set(cacheKey, result);

            return result;
        } catch (error) {
            logger.error('Failed to process text:', error instanceof Error ? error : new Error(String(error)));
            throw error;
        }
    }

    public async processVoice(audio: Buffer): Promise<string> {
        try {
            // This is a placeholder for speech-to-text implementation
            // In a real implementation, this would integrate with a speech recognition service
            logger.info('Processing voice input', { audioLength: audio.length });
            
            // Return a dummy response for now
            return "Voice processing placeholder response";
        } catch (error) {
            logger.error('Failed to process voice:', error instanceof Error ? error : new Error(String(error)));
            throw error;
        }
    }

    public async processTextStreaming(text: string): Promise<void> {
        const abortController = new AbortController();
        let streamTimeout: NodeJS.Timeout;

        try {
            // Set maximum streaming duration
            streamTimeout = setTimeout(() => {
                abortController.abort();
                this.emit('error', new Error('Stream duration exceeded'));
            }, this.streamingConfig.maxStreamDuration);

            logger.info('Starting text streaming', { textLength: text.length });

            const stream = await this.client.messages.create({
                model: 'claude-3-opus-20240229',
                max_tokens: this.config.maxTokens || 1024,
                temperature: this.config.temperature || 0.7,
                messages: [{
                    role: 'user',
                    content: text
                }],
                system: `You are Iroh, a wise and kind AI assistant accessed through a vintage telephone. 
                        You provide thoughtful advice and help control smart home features.`,
                stream: true
            });

            let accumulatedText = '';

            for await (const chunk of stream) {
                if (chunk.type === 'content_block_delta') {
                    accumulatedText += chunk.delta.text;
                    
                    // Emit text chunks based on configured size
                    if (accumulatedText.length >= this.streamingConfig.textChunkSize) {
                        this.emit('textChunk', accumulatedText);
                        accumulatedText = '';
                    }
                }
            }

            // Handle any remaining text
            if (accumulatedText) {
                this.emit('textChunk', accumulatedText);
            }

            this.emit('streamComplete');

        } catch (error) {
            logger.error('Error in text streaming:', error instanceof Error ? error : new Error(String(error)));
            this.emit('error', error);
        } finally {
            clearTimeout(streamTimeout!);
        }
    }

    public async shutdown(): Promise<void> {
        try {
            await this.cache.shutdown();
            this.removeAllListeners();
            this.serviceStatus.state = 'shutdown';
            this.serviceStatus.isHealthy = false;
            this.serviceStatus.lastUpdate = new Date();
        } catch (error) {
            this.serviceStatus.lastError = error instanceof Error ? error : new Error(String(error));
            throw error;
        }
    }

    // Control methods for streaming
    public pauseStream(): void {
        this.emit('streamPause');
    }

    public resumeStream(): void {
        this.emit('streamResume');
    }

    public stopStream(): void {
        this.emit('streamStop');
    }

    public getStatus(): ServiceStatus {
        return { ...this.serviceStatus };
    }

    public isHealthy(): boolean {
        return this.serviceStatus.isHealthy;
    }

    // Type-safe event emitter
    emit<K extends keyof AIServiceEvents>(
        event: K, 
        ...args: Parameters<AIServiceEvents[K]>
    ): boolean {
        return super.emit(event, ...args);
    }

    on<K extends keyof AIServiceEvents>(
        event: K, 
        listener: AIServiceEvents[K]
    ): this {
        return super.on(event, listener);
    }
}