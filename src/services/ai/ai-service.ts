// src/services/ai/ai-service.ts
//
// AI service implementation that handles:
// - Text processing with Anthropic's Claude API
// - Speech synthesis with ElevenLabs API
// - Streaming audio and text responses
// - Error handling and logging
// - Cache management for responses
// - Voice and speech handling

import { Client } from '@anthropic-ai/sdk';
import { Voice, VoiceSettings, generateVoice } from 'elevenlabs-node';
import { EventEmitter } from 'events';
import { logger } from '../../utils/logger';
import { ConversationManager } from './conversation-manager';
import { Cache } from '../../utils/cache';

// Define service interfaces
export interface AIService {
    initialize(): Promise<void>;
    generateSpeech(text: string): Promise<Buffer>;
    shutdown(): Promise<void>;
    processText(text: string): Promise<string>;
    processVoice(audio: Buffer): Promise<string>;
}

export interface AIServiceConfig {
    anthropicKey: string;
    elevenlabsKey: string;
    openAIKey?: string;
    maxTokens?: number;
    temperature?: number;
    voiceId?: string;
    voiceSettings?: VoiceSettings;
}

interface StreamingConfig {
    textChunkSize: number;      // Characters per text chunk
    audioChunkSize: number;     // Bytes per audio chunk
    maxStreamDuration: number;  // Maximum streaming duration in ms
}

export class IrohAIService extends EventEmitter implements AIService {
    private client: Client;
    private isInitialized: boolean = false;
    private streamingConfig: StreamingConfig;
    private cache: Cache;
    private conversationManager: ConversationManager;
    private voiceSettings: VoiceSettings;

    constructor(private config: AIServiceConfig) {
        super();
        
        // Initialize Anthropic client
        this.client = new Client(config.anthropicKey);
        
        // Set default voice settings
        this.voiceSettings = config.voiceSettings || {
            stability: 0.75,      // Higher stability for consistent output
            similarityBoost: 0.8, // Higher similarity for more natural voice
            style: 0.5,          // Balanced speaking style
            speakerBoost: true    // Enhanced speaker clarity
        };

        // Initialize streaming config
        this.streamingConfig = {
            textChunkSize: 100,   // 100 characters per text chunk
            audioChunkSize: 4096, // 4KB audio chunks
            maxStreamDuration: 30000 // 30 seconds max stream
        };

        // Initialize cache with 1-hour TTL
        this.cache = new Cache({
            namespace: 'ai-responses',
            ttl: 1 * 60 * 60 * 1000  // 1 hour
        });

        // Initialize conversation manager
        this.conversationManager = new ConversationManager();
    }

    public async initialize(): Promise<void> {
        try {
            // Validate required API keys
            if (!this.config.anthropicKey) {
                throw new Error('Anthropic API key is required');
            }
            if (!this.config.elevenlabsKey) {
                throw new Error('ElevenLabs API key is required');
            }

            // Test API connections
            await this.testAnthropicConnection();
            await this.testElevenLabsConnection();

            this.isInitialized = true;
            logger.info('AI Service initialized successfully');
        } catch (error) {
            logger.error('Failed to initialize AI Service:', error instanceof Error ? error : new Error(String(error)));
            throw error;
        }
    }

    private async testAnthropicConnection(): Promise<void> {
        try {
            await this.client.messages.create({
                model: 'claude-3-opus-20240229',
                max_tokens: 10,
                messages: [{ role: 'user', content: 'test' }]
            });
            logger.info('Anthropic connection test successful');
        } catch (error) {
            logger.error('Anthropic connection test failed:', error instanceof Error ? error : new Error(String(error)));
            throw new Error('Failed to connect to Anthropic API');
        }
    }

    private async testElevenLabsConnection(): Promise<void> {
        try {
            // Attempt to fetch voice settings to verify connection
            await this.getVoiceDetails(this.config.voiceId || 'josh');
            logger.info('ElevenLabs connection test successful');
        } catch (error) {
            logger.error('ElevenLabs connection test failed:', error instanceof Error ? error : new Error(String(error)));
            throw new Error('Failed to connect to ElevenLabs API');
        }
    }

    private async getVoiceDetails(voiceId: string): Promise<Voice> {
        try {
            // Implementation would depend on elevenlabs-node API
            // This is a placeholder until we have actual API access
            return {
                voice_id: voiceId,
                name: 'Iroh',
                settings: this.voiceSettings
            } as Voice;
        } catch (error) {
            logger.error('Failed to get voice details:', error instanceof Error ? error : new Error(String(error)));
            throw error;
        }
    }

    public async generateSpeech(text: string): Promise<Buffer> {
        try {
            // Check cache first
            const cacheKey = `speech:${text}:${this.config.voiceId}`;
            const cached = await this.cache.get<Buffer>(cacheKey);
            if (cached) {
                logger.debug('Cache hit for speech generation');
                return cached;
            }

            logger.info('Generating speech with ElevenLabs', { 
                textLength: text.length,
                voiceId: this.config.voiceId 
            });

            const audioBuffer = await generateVoice({
                apiKey: this.config.elevenlabsKey,
                textInput: text,
                voiceId: this.config.voiceId || 'josh',
                voiceSettings: this.voiceSettings,
            });

            // Cache the response
            await this.cache.set(cacheKey, audioBuffer);

            return audioBuffer;
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
                }]
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
            logger.info('Processing voice input', { audioLength: audio.length });
            
            // Note: When implementing actual speech-to-text, 
            // you would integrate with a service like Whisper here
            // For now we return a placeholder
            return "Voice processing is not yet implemented";
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
                messages: [
                    {
                        role: 'system',
                        content: `You are Iroh, a wise and kind AI assistant accessed through a vintage telephone. 
                                You provide thoughtful advice and help control smart home features.`
                    },
                    {
                        role: 'user',
                        content: text
                    }
                ],
                stream: true
            }, { signal: abortController.signal });

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

    public async generateSpeechStream(text: string): Promise<void> {
        try {
            logger.info('Starting speech streaming', { textLength: text.length });

            // Generate the entire audio first
            const audioBuffer = await this.generateSpeech(text);

            // Stream it in chunks
            for (let i = 0; i < audioBuffer.length; i += this.streamingConfig.audioChunkSize) {
                const chunk = audioBuffer.slice(i, i + this.streamingConfig.audioChunkSize);
                this.emit('audioChunk', chunk);
                
                // Add a small delay between chunks to simulate streaming
                await new Promise(resolve => setTimeout(resolve, 50));
            }

            this.emit('streamComplete');
        } catch (error) {
            logger.error('Error in speech streaming:', error instanceof Error ? error : new Error(String(error)));
            this.emit('error', error);
        }
    }

    public async shutdown(): Promise<void> {
        try {
            await this.cache.shutdown();
            this.removeAllListeners();
            this.isInitialized = false;
            logger.info('AI Service shut down');
        } catch (error) {
            logger.error('Failed to shutdown AI Service:', error instanceof Error ? error : new Error(String(error)));
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
}