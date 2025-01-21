// src/tests/setup.ts
//
// Test setup and utilities for the Iroh project
// Includes mock implementations and helper functions

import { EventEmitter } from 'events';
import { jest } from '@jest/globals';

// Mock implementations
export class MockFXSInterface extends EventEmitter {
    public start = jest.fn().mockResolvedValue(undefined);
    public stop = jest.fn().mockResolvedValue(undefined);
    public playAudio = jest.fn().mockResolvedValue(undefined);
    public isOpen = jest.fn().mockReturnValue(false);
}

export class MockAIService extends EventEmitter {
    public processText = jest.fn().mockResolvedValue('Mock AI Response');
    public generateSpeech = jest.fn().mockResolvedValue(Buffer.from('Mock Audio'));
    public shutdown = jest.fn().mockResolvedValue(undefined);
}

export class MockDTMFDetector extends EventEmitter {
    public analyze = jest.fn().mockResolvedValue(null);
    public clear = jest.fn();
    public shutdown = jest.fn();
}

// Test utilities
export function createMockAudioInput(duration: number = 1000) {
    return {
        sampleRate: 8000,
        channels: 1,
        bitDepth: 16,
        data: Buffer.alloc(duration * 8) // 8 bytes per millisecond at 8kHz
    };
}

export function createMockConfig() {
    return {
        app: {
            name: 'iroh-test',
            env: 'test',
            port: 3000
        },
        audio: {
            sampleRate: 8000,
            channels: 1,
            bitDepth: 16,
            vadThreshold: 0.3,
            silenceThreshold: 500
        },
        ai: {
            anthropicKey: 'test-key',
            maxTokens: 1024,
            temperature: 0.7,
            voiceId: 'test-voice'
        },
        logging: {
            level: 'debug',
            directory: 'logs',
            maxFiles: '14d',
            maxSize: '20m'
        }
    };
}

// src/tests/phone-controller.test.ts
//
// Tests for the PhoneController class

import { PhoneController } from '../controllers/phone-controller';
import { MockFXSInterface, MockDTMFDetector, createMockConfig } from './setup';

jest.mock('../hardware/fxs-interface', () => ({
    FXSInterface: jest.fn().mockImplementation(() => new MockFXSInterface())
}));

jest.mock('../audio/dtmf-detector', () => ({
    DTMFDetector: jest.fn().mockImplementation(() => new MockDTMFDetector())
}));

describe('PhoneController', () => {
    let phoneController: PhoneController;
    let mockFXS: MockFXSInterface;
    let mockDTMF: MockDTMFDetector;

    beforeEach(() => {
        jest.clearAllMocks();
        const config = createMockConfig();
        phoneController = new PhoneController({ fxs: config.audio });
        mockFXS = new MockFXSInterface();
        mockDTMF = new MockDTMFDetector();
    });

    afterEach(() => {
        phoneController.removeAllListeners();
    });

    describe('initialization', () => {
        it('should initialize successfully', async () => {
            await expect(phoneController.start()).resolves.not.toThrow();
            expect(mockFXS.start).toHaveBeenCalled();
        });

        it('should handle initialization errors', async () => {
            mockFXS.start.mockRejectedValueOnce(new Error('Hardware error'));
            await expect(phoneController.start()).rejects.toThrow('Hardware error');
        });
    });

    describe('event handling', () => {
        it('should handle off-hook events', (done) => {
            phoneController.on('off_hook', () => {
                done();
            });
            mockFXS.emit('off_hook');
        });

        it('should handle on-hook events', (done) => {
            phoneController.on('on_hook', () => {
                done();
            });
            mockFXS.emit('on_hook');
        });
    });

    describe('audio playback', () => {
        it('should play audio when active', async () => {
            const audioBuffer = Buffer.from('test audio');
            mockFXS.isOpen.mockReturnValue(true);
            await phoneController.playAudio(audioBuffer);
            expect(mockFXS.playAudio).toHaveBeenCalledWith(audioBuffer);
        });

        it('should not play audio when inactive', async () => {
            const audioBuffer = Buffer.from('test audio');
            mockFXS.isOpen.mockReturnValue(false);
            await phoneController.playAudio(audioBuffer);
            expect(mockFXS.playAudio).not.toHaveBeenCalled();
        });
    });
});

// src/tests/dtmf-detector.test.ts
//
// Tests for the DTMFDetector class

import { DTMFDetector } from '../audio/dtmf-detector';
import { createMockAudioInput } from './setup';

describe('DTMFDetector', () => {
    let detector: DTMFDetector;

    beforeEach(() => {
        detector = new DTMFDetector({ sampleRate: 8000 });
    });

    afterEach(() => {
        detector.shutdown();
    });

    it('should detect valid DTMF tones', (done) => {
        const input = createMockAudioInput();
        
        detector.on('dtmf', (event) => {
            expect(event).toHaveProperty('digit');
            expect(event).toHaveProperty('duration');
            expect(event).toHaveProperty('timestamp');
            done();
        });

        detector.analyze(input);
    });

    it('should ignore short DTMF tones', async () => {
        const input = createMockAudioInput(10); // 10ms duration
        const result = await detector.analyze(input);
        expect(result).toBeNull();
    });

    it('should clear internal state', () => {
        detector.clear();
        expect(detector.analyze(createMockAudioInput())).resolves.toBeNull();
    });
});

// src/tests/ai-service.test.ts
//
// Tests for the IrohAIService class

import { IrohAIService } from '../services/ai/ai-service';
import { createMockConfig } from './setup';

jest.mock('@anthropic-ai/sdk', () => ({
    Anthropic: jest.fn().mockImplementation(() => ({
        messages: {
            create: jest.fn().mockResolvedValue({
                content: [{ text: 'Mock response' }]
            })
        }
    }))
}));

describe('IrohAIService', () => {
    let aiService: IrohAIService;

    beforeEach(() => {
        const config = createMockConfig();
        aiService = new IrohAIService(config.ai);
    });

    afterEach(async () => {
        await aiService.shutdown();
    });

    describe('text processing', () => {
        it('should process text input', async () => {
            const response = await aiService.processText('Hello');
            expect(response).toBeDefined();
            expect(typeof response).toBe('string');
        });

        it('should handle errors gracefully', async () => {
            jest.spyOn(console, 'error').mockImplementation(() => {}); // Suppress error logs
            const anthropic = require('@anthropic-ai/sdk').Anthropic;
            anthropic.mockImplementationOnce(() => ({
                messages: {
                    create: jest.fn().mockRejectedValue(new Error('API Error'))
                }
            }));

            await expect(aiService.processText('Hello')).rejects.toThrow('API Error');
        });
    });

    describe('speech generation', () => {
        it('should generate speech from text', async () => {
            const audio = await aiService.generateSpeech('Hello');
            expect(Buffer.isBuffer(audio)).toBe(true);
        });
    });
});

// src/tests/cache.test.ts
//
// Tests for the Cache class

import { Cache } from '../utils/cache';

describe('Cache', () => {
    let cache: Cache;

    beforeEach(() => {
        cache = new Cache({
            ttl: 100, // 100ms TTL for testing
            maxSize: 3,
            namespace: 'test'
        });
    });

    afterEach(() => {
        cache.shutdown();
    });

    it('should store and retrieve values', async () => {
        await cache.set('key1', 'value1');
        const value = await cache.get('key1');
        expect(value).toBe('value1');
    });

    it('should respect TTL', async () => {
        await cache.set('key1', 'value1', 50); // 50ms TTL
        await new Promise(resolve => setTimeout(resolve, 60));
        const value = await cache.get('key1');
        expect(value).toBeNull();
    });

    it('should respect max size', async () => {
        await cache.set('key1', 'value1');
        await cache.set('key2', 'value2');
        await cache.set('key3', 'value3');
        await cache.set('key4', 'value4'); // Should evict key1

        expect(await cache.get('key1')).toBeNull();
        expect(await cache.get('key4')).toBe('value4');
    });

    it('should clear all entries', async () => {
        await cache.set('key1', 'value1');
        await cache.set('key2', 'value2');
        cache.clear();
        expect(await cache.get('key1')).toBeNull();
        expect(await cache.get('key2')).toBeNull();
    });
});