// src/hardware/fxs-interface.ts
//
// Key Features:
// - Hardware communication with FXS module
// - Phone state detection (on/off hook)
// - Audio stream management
// - Ring signal control
// - Input/output buffering
// - Error recovery
// - Line voltage monitoring
//
// Usage:
// const fxs = new FXSInterface(config);
// fxs.on('offHook', handleCall);
// fxs.on('audioData', processAudio);

import { EventEmitter } from 'events';
import { SerialPort } from 'serialport';
import { AudioInput } from '../types';
import { logger } from '../utils/logger';

interface FXSConfig {
    devicePath: string;      // Serial port path
    baudRate: number;        // Serial communication speed
    sampleRate: number;      // Audio sample rate
    channels: number;        // Number of audio channels
    bitDepth: number;        // Audio bit depth
}

enum PhoneState {
    IDLE = 'idle',
    RINGING = 'ringing',
    OFF_HOOK = 'off_hook',
    IN_CALL = 'in_call'
}

export class FXSInterface extends EventEmitter {
    private readonly config: FXSConfig;
    private serialPort: SerialPort;
    private state: PhoneState = PhoneState.IDLE;
    private audioBuffer: Buffer[] = [];
    private readonly bufferSize: number = 320; // Bytes to buffer before emitting

    constructor(config: Partial<FXSConfig> = {}) {
        super();
        this.config = {
            devicePath: '/dev/ttyUSB0',
            baudRate: 115200,
            sampleRate: 8000,
            channels: 1,
            bitDepth: 16,
            ...config
        };

        this.initialize();
    }

    private async initialize(): Promise<void> {
        try {
            this.serialPort = new SerialPort({
                path: this.config.devicePath,
                baudRate: this.config.baudRate,
                autoOpen: false
            });

            // Set up event handlers
            this.serialPort.on('open', () => {
                logger.info('FXS serial port opened', {
                    device: this.config.devicePath
                });
                this.initializeHardware();
            });

            this.serialPort.on('data', (data: Buffer) => {
                this.handleSerialData(data);
            });

            this.serialPort.on('error', (error) => {
                logger.error('FXS serial error:', error);
                this.emit('error', error);
                this.attemptRecovery();
            });

            await this.openPort();
        } catch (error) {
            logger.error('Failed to initialize FXS interface:', error);
            throw error;
        }
    }

    private async openPort(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.serialPort.open((error) => {
                if (error) {
                    reject(error);
                    return;
                }
                resolve();
            });
        });
    }

    private async initializeHardware(): Promise<void> {
        // Send initialization commands to FXS module
        const initCommands = [
            Buffer.from([0x01, 0x01]), // Reset
            Buffer.from([0x02, 0x01]), // Enable audio
            Buffer.from([0x03, this.config.sampleRate >> 8, this.config.sampleRate & 0xFF]), // Set sample rate
        ];

        for (const cmd of initCommands) {
            await this.sendCommand(cmd);
        }
    }

    private async sendCommand(command: Buffer): Promise<void> {
        return new Promise((resolve, reject) => {
            this.serialPort.write(command, (error) => {
                if (error) {
                    reject(error);
                    return;
                }
                resolve();
            });
        });
    }

    private handleSerialData(data: Buffer): void {
        // First byte indicates packet type
        const packetType = data[0];

        switch (packetType) {
            case 0x10: // Phone state change
                this.handleStateChange(data[1]);
                break;
            case 0x20: // Audio data
                this.handleAudioData(data.slice(1));
                break;
            case 0x30: // Line voltage info
                this.handleVoltageInfo(data.slice(1));
                break;
            default:
                logger.warn('Unknown packet type:', packetType);
        }
    }

    private handleStateChange(stateCode: number): void {
        const previousState = this.state;
        
        switch (stateCode) {
            case 0x00:
                this.state = PhoneState.IDLE;
                break;
            case 0x01:
                this.state = PhoneState.OFF_HOOK;
                break;
            case 0x02:
                this.state = PhoneState.RINGING;
                break;
            case 0x03:
                this.state = PhoneState.IN_CALL;
                break;
            default:
                logger.warn('Unknown state code:', stateCode);
                return;
        }

        if (this.state !== previousState) {
            logger.info('Phone state changed', {
                from: previousState,
                to: this.state
            });
            this.emit(this.state);
        }
    }

    private handleAudioData(data: Buffer): void {
        this.audioBuffer.push(data);
        
        // Check if we have enough data to emit
        const totalLength = this.audioBuffer.reduce((sum, buf) => sum + buf.length, 0);
        if (totalLength >= this.bufferSize) {
            const combinedBuffer = Buffer.concat(this.audioBuffer);
            
            // Emit complete chunks
            const chunks = Math.floor(totalLength / this.bufferSize);
            for (let i = 0; i < chunks; i++) {
                const chunk = combinedBuffer.slice(
                    i * this.bufferSize,
                    (i + 1) * this.bufferSize
                );
                
                const audioInput: AudioInput = {
                    sampleRate: this.config.sampleRate,
                    channels: this.config.channels,
                    bitDepth: this.config.bitDepth,
                    data: chunk
                };

                this.emit('audioData', audioInput);
            }

            // Keep remaining data
            const remaining = totalLength % this.bufferSize;
            this.audioBuffer = remaining ? 
                [combinedBuffer.slice(chunks * this.bufferSize)] : 
                [];
        }
    }

    private handleVoltageInfo(data: Buffer): void {
        const voltage = data.readUInt16BE(0) / 10; // Convert to volts
        this.emit('voltage', voltage);

        // Check for voltage issues
        if (voltage < 20) {
            logger.warn('Low line voltage detected', { voltage });
        }
    }

    public async ring(duration: number = 2000): Promise<void> {
        if (this.state !== PhoneState.IDLE) {
            logger.warn('Cannot ring phone - not in idle state');
            return;
        }

        try {
            await this.sendCommand(Buffer.from([0x04, 0x01])); // Start ringing
            await new Promise(resolve => setTimeout(resolve, duration));
            await this.sendCommand(Buffer.from([0x04, 0x00])); // Stop ringing
        } catch (error) {
            logger.error('Error during ring cycle:', error);
            throw error;
        }
    }

    public async playAudio(audioData: Buffer): Promise<void> {
        if (this.state !== PhoneState.IN_CALL) {
            logger.warn('Cannot play audio - not in call');
            return;
        }

        try {
            // Split audio into manageable chunks and send
            const chunkSize = 256;
            for (let i = 0; i < audioData.length; i += chunkSize) {
                const chunk = audioData.slice(i, i + chunkSize);
                const command = Buffer.concat([
                    Buffer.from([0x05]), // Audio output command
                    chunk
                ]);
                await this.sendCommand(command);
            }
        } catch (error) {
            logger.error('Error playing audio:', error);
            throw error;
        }
    }

    private async attemptRecovery(): Promise<void> {
        logger.info('Attempting FXS interface recovery');
        
        try {
            if (this.serialPort.isOpen) {
                await new Promise(resolve => this.serialPort.close(resolve));
            }
            await new Promise(resolve => setTimeout(resolve, 1000));
            await this.openPort();
            await this.initializeHardware();
            logger.info('FXS interface recovery successful');
        } catch (error) {
            logger.error('Recovery failed:', error);
            throw error;
        }
    }

    public async shutdown(): Promise<void> {
        logger.info('Shutting down FXS interface');
        
        try {
            await this.sendCommand(Buffer.from([0x01, 0x00])); // Disable
            this.removeAllListeners();
            await new Promise(resolve => this.serialPort.close(resolve));
        } catch (error) {
            logger.error('Error during shutdown:', error);
            throw error;
        }
    }
}

// Example usage:
async function example() {
    const fxs = new FXSInterface({
        devicePath: '/dev/ttyUSB0',
        sampleRate: 8000
    });

    // Handle phone state changes
    fxs.on(PhoneState.OFF_HOOK, () => {
        console.log('Phone taken off hook');
    });

    fxs.on(PhoneState.IN_CALL, () => {
        console.log('Call in progress');
    });

    // Handle audio data
    fxs.on('audioData', (audioInput: AudioInput) => {
        // Process audio data
        console.log(`Received ${audioInput.data.length} bytes of audio`);
    });

    // Handle errors
    fxs.on('error', (error) => {
        console.error('FXS error:', error);
    });

    // Ring the phone
    await fxs.ring(2000);
}