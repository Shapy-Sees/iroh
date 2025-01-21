import { config } from 'dotenv';

config(); // Load .env file

export interface FXSHardwareConfig {
    devicePath: string;
    sampleRate: number;  // Make this required
    hookPin?: number;
    audioInPin?: number;
    audioOutPin?: number;
    ringPin?: number;
    bufferSize?: number;
    channels?: number;
    bitDepth?: number;
}

// Ensure sampleRate is always a number with a default value
export const fxsConfig: FXSHardwareConfig = {
    devicePath: process.env.FXS_DEVICE_PATH || '/dev/ttyUSB0',
    sampleRate: Number(process.env.FXS_SAMPLE_RATE || 44100),  // Force number type
    hookPin: Number(process.env.FXS_HOOK_PIN || 17),
    audioInPin: Number(process.env.FXS_AUDIO_IN_PIN || 18),
    audioOutPin: Number(process.env.FXS_AUDIO_OUT_PIN || 19),
    ringPin: Number(process.env.FXS_RING_PIN || 20),
    bufferSize: Number(process.env.FXS_BUFFER_SIZE || 320),
    channels: Number(process.env.FXS_CHANNELS || 1),
    bitDepth: Number(process.env.FXS_BIT_DEPTH || 16),
};
