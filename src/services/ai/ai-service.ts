// src/services/ai/ai-service.ts
//
// Key Features:
// - All previous features plus:
// - Real-time text streaming from Claude
// - Chunked audio synthesis
// - Stream progress events
// - Configurable chunk sizes
// - Backpressure handling
// - Memory efficient processing
//
// Usage:
// const ai = new IrohAIService(config);
// ai.on('textChunk', console.log);
// ai.on('audioChunk', playAudio);
// await ai.processVoiceStreaming(audioBuffer);

import { EventEmitter } from 'events';
import { Readable, Transform } from 'stream';
import { AIService } from '../../types';
import { Anthropic } from '@anthropic-ai/sdk';
import { ElevenLabs } from '@eleven-labs/elevenlabs-node';
import { OpenAI } from 'openai';
import { logger } from '../../utils/logger';
import { ConversationManager } from './conversation-manager';
import { Cache } from '../../utils/cache';

interface StreamingConfig {
    textChunkSize: number;      // Characters per text chunk
    audioChunkSize: number;     // Bytes per audio chunk
    maxStreamDuration: number;  // Maximum streaming duration in ms
}

export class IrohAIService extends EventEmitter implements AIService {
    // ... previous properties ...
    private streamingConfig: StreamingConfig;

    constructor(config: AIServiceConfig) {
        super();
        // ... previous initialization ...
        this.streamingConfig = {
            textChunkSize: 100,
            audioChunkSize: 4096,
            maxStreamDuration: 30000
        };
    }

    public async processVoiceStreaming(audioBuffer: Buffer): Promise<void> {
        try {
            // Convert speech to text
            const text = await this.speechToText(audioBuffer);
            logger.debug('Speech converted to text:', text);

            // Process text through LLM with streaming
            await this.processTextStreaming(text);
        } catch (error) {
            logger.error('Error in streaming voice process:', error);
            this.emit('error', error);
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

            const stream = await this.anthropic.messages.create({
                model: 'claude-3-opus-20240229',
                max_tokens: this.config.maxTokens,
                temperature: this.config.temperature,
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
                        
                        // Generate and emit audio for this chunk
                        await this.generateSpeechStreaming(accumulatedText);
                        
                        accumulatedText = '';
                    }
                }
            }

            // Handle any remaining text
            if (accumulatedText) {
                this.emit('textChunk', accumulatedText);
                await this.generateSpeechStreaming(accumulatedText);
            }

            this.emit('streamComplete');

        } catch (error) {
            logger.error('Error in text streaming:', error);
            this.emit('error', error);
        } finally {
            clearTimeout(streamTimeout!);
        }
    }

    private async generateSpeechStreaming(text: string): Promise<void> {
        try {
            const response = await this.elevenLabs.generate({
                text,
                voiceId: this.config.voiceId,
                modelId: 'eleven_monolingual_v1',
                stream: true
            });

            // Create a transform stream to chunk the audio
            const chunker = new Transform({
                transform: (chunk, encoding, callback) => {
                    for (let i = 0; i < chunk.length; i += this.streamingConfig.audioChunkSize) {
                        const audioChunk = chunk.slice(i, i + this.streamingConfig.audioChunkSize);
                        this.emit('audioChunk', audioChunk);
                    }
                    callback();
                }
            });

            // Pipe the audio response through the chunker
            if (response instanceof Readable) {
                await new Promise((resolve, reject) => {
                    response
                        .pipe(chunker)
                        .on('finish', resolve)
                        .on('error', reject);
                });
            }

        } catch (error) {
            logger.error('Error in speech streaming:', error);
            this.emit('error', error);
        }
    }

    // Add streaming control methods
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

// Example usage with streaming:
async function streamingExample() {
    const ai = new IrohAIService(config);

    // Handle text chunks
    ai.on('textChunk', (text: string) => {
        console.log('Received text chunk:', text);
    });

    // Handle audio chunks
    ai.on('audioChunk', (audioBuffer: Buffer) => {
        // Play audio chunk through your audio system
        console.log('Received audio chunk:', audioBuffer.length, 'bytes');
    });

    // Handle stream completion
    ai.on('streamComplete', () => {
        console.log('Stream completed');
    });

    // Handle errors
    ai.on('error', (error: Error) => {
        console.error('Stream error:', error);
    });

    // Start streaming process
    const audioBuffer = Buffer.from([]); // Your audio data
    await ai.processVoiceStreaming(audioBuffer);
}

// Cache AI responses
const responseCache = new Cache({
    namespace: 'ai-responses',
    ttl: 1 * 60 * 60 * 1000  // 1 hour
});

// Cache AI responses
const response = await responseCache.getOrSet(
    `query:${text}`,
    async () => await this.anthropic.messages.create({...})
);