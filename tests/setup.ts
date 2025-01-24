// src/tests/setup.ts
//
// Test setup and utilities for the Iroh project
// Includes mock implementations and helper functions
// for testing DAHDI hardware integration and services

import { EventEmitter } from 'events';
import { jest } from '@jest/globals';

// Mock DAHDI hardware interface
export class MockDAHDIInterface extends EventEmitter {
    private isOpen: boolean = false;
    private channelState: Map<number, {
        isRinging: boolean;
        isOffHook: boolean;
        voltage: number;
    }> = new Map();

    constructor() {
        super();
        // Initialize default channel state
        this.channelState.set(1, {
            isRinging: false,
            isOffHook: false,
            voltage: 48 // Normal FXS voltage
        });
    }

    public open = jest.fn().mockImplementation(async () => {
        this.isOpen = true;
        return Promise.resolve();
    });

    public close = jest.fn().mockImplementation(async () => {
        this.isOpen = false;
        return Promise.resolve();
    });

    public writeAudio = jest.fn().mockImplementation(async (buffer: Buffer) => {
        return Promise.resolve();
    });

    public readAudio = jest.fn().mockImplementation(async () => {
        return Promise.resolve(Buffer.alloc(320)); // 20ms of silence at 8kHz
    });

    public getChannelState = jest.fn().mockImplementation((channel: number) => {
        return this.channelState.get(channel);
    });

    public setRinging = jest.fn().mockImplementation((channel: number, ringing: boolean) => {
        const state = this.channelState.get(channel);
        if (state) {
            state.isRinging = ringing;
            this.emit('ring', { channel, state: ringing });
        }
    });

    public setHookState = jest.fn().mockImplementation((channel: number, offHook: boolean) => {
        const state = this.channelState.get(channel);
        if (state) {
            state.isOffHook = offHook;
            this.emit('hook_state', { channel, offHook });
        }
    });

    public isDeviceOpen = jest.fn().mockImplementation(() => this.isOpen);
}

// Mock FXS Interface that uses DAHDI
export class MockFXSInterface extends EventEmitter {
    private dahdi: MockDAHDIInterface;

    constructor() {
        super();
        this.dahdi = new MockDAHDIInterface();
    }

    public start = jest.fn().mockImplementation(async () => {
        await this.dahdi.open();
        this.emit('ready');
        return Promise.resolve();
    });

    public stop = jest.fn().mockImplementation(async () => {
        await this.dahdi.close();
        return Promise.resolve();
    });

    public playAudio = jest.fn().mockImplementation(async (buffer: Buffer) => {
        await this.dahdi.writeAudio(buffer);
        return Promise.resolve();
    });

    public isOpen = jest.fn().mockImplementation(() => 
        this.dahdi.isDeviceOpen()
    );

    // Helper method for tests to simulate phone events
    public simulateOffHook(): void {
        this.dahdi.setHookState(1, true);
        this.emit('off_hook');
    }

    public simulateOnHook(): void {
        this.dahdi.setHookState(1, false);
        this.emit('on_hook');
    }

    public simulateRing(): void {
        this.dahdi.setRinging(1, true);
        setTimeout(() => this.dahdi.setRinging(1, false), 2000);
    }
}

// Mock AI Service
export class MockAIService extends EventEmitter {
    public processText = jest.fn().mockImplementation(async (text: string) => {
        return Promise.resolve('Mock AI Response');
    });

    public generateSpeech = jest.fn().mockImplementation(async (text: string) => {
        return Promise.resolve(Buffer.from('Mock Audio'));
    });

    public shutdown = jest.fn().mockImplementation(async () => {
        return Promise.resolve();
    });
}

// Mock DTMF Detector that would normally process DAHDI audio
export class MockDTMFDetector extends EventEmitter {
    public analyze = jest.fn().mockImplementation(async (input: {
        sampleRate: number;
        data: Buffer;
    }) => {
        return Promise.resolve(null);
    });

    public clear = jest.fn();
    public shutdown = jest.fn();

    // Helper for tests to simulate DTMF detection
    public simulateDigit(digit: string, duration: number = 100): void {
        this.emit('dtmf', {
            digit,
            duration,
            timestamp: Date.now()
        });
    }
}

// Test data generators
export function createMockAudioInput(duration: number = 1000) {
    return {
        sampleRate: 8000,  // DAHDI sample rate
        channels: 1,       // DAHDI is mono
        bitDepth: 16,      // DAHDI uses 16-bit PCM
        data: Buffer.alloc(duration * 16) // 16 bytes per ms at 8kHz/16-bit
    };
}

// Mock configuration factory
export function createMockConfig() {
    return {
        app: {
            name: 'iroh-test',
            env: 'test',
            port: 3000
        },
        dahdi: {
            device: '/dev/dahdi/channel001',
            span: 1,
            channel: 1,
            loadzone: 'us',
            defaultzone: 'us',
            echocancel: true,
            echocanceltaps: 128
        },
        audio: {
            sampleRate: 8000,
            channels: 1,
            bitDepth: 16,
            vadThreshold: 0.3,
            silenceThreshold: 500
        },
        homeAssistant: {
            url: 'http://localhost:8123',
            token: 'mock_token',
            entityPrefix: 'test_',
            updateInterval: 1000
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

// Example test using the mocks
describe('Phone Controller with DAHDI', () => {
    let phoneController: any;
    let mockFXS: MockFXSInterface;
    let mockDTMF: MockDTMFDetector;
    let mockConfig: ReturnType<typeof createMockConfig>;

    beforeEach(() => {
        mockConfig = createMockConfig();
        mockFXS = new MockFXSInterface();
        mockDTMF = new MockDTMFDetector();

        phoneController = new PhoneController({
            fxs: mockConfig.dahdi,
            audio: mockConfig.audio
        });
    });

    afterEach(() => {
        phoneController.removeAllListeners();
        mockFXS.removeAllListeners();
        mockDTMF.removeAllListeners();
    });

    test('should handle off-hook state', async () => {
        const offHookHandler = jest.fn();
        phoneController.on('off_hook', offHookHandler);

        mockFXS.simulateOffHook();
        expect(offHookHandler).toHaveBeenCalled();
    });

    test('should handle DTMF input', async () => {
        const dtmfHandler = jest.fn();
        phoneController.on('dtmf', dtmfHandler);

        mockDTMF.simulateDigit('5');
        expect(dtmfHandler).toHaveBeenCalledWith(
            expect.objectContaining({ digit: '5' })
        );
    });

    test('should process audio through DAHDI', async () => {
        const audioInput = createMockAudioInput();
        await phoneController.processAudio(audioInput);
        expect(mockFXS.playAudio).toHaveBeenCalled();
    });
});