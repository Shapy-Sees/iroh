// src/types/hardware.ts
// This file defines the configuration for the hardware interface.


import { BaseConfig } from './core';
import { DAHDI_CONSTANTS } from '../config/constants';
import { AudioConfig } from './hardware/audio';
import { DAHDIConfig } from './hardware/dahdi';
import { FXSConfig } from './hardware/fxs';

export enum HardwareState {
    INITIALIZING = 'initializing',
    READY = 'ready',
    ERROR = 'error',
    OFFLINE = 'offline'
}

export interface HardwareConfig extends BaseConfig {
    dahdi: DAHDIConfig;
    audio: AudioConfig;
    fxs?: FXSConfig;
}

export { DAHDIConfig } from './hardware/dahdi';
export { AudioConfig, AudioFormat } from './hardware/audio';
export { FXSConfig } from './hardware/fxs';

export interface DAHDIConfig extends BaseConfig {
    devicePath: string;
    controlPath: string;
    sampleRate: typeof DAHDI_CONSTANTS.SAMPLE_RATE;
    channels: 1;
    bitDepth: 16;
    bufferSize: number;
    channel: {
        number: number;
        ringCadence: [number, number];
        callerIdFormat: string;
        impedance: 600 | 900;
        gain: {
            rx: number;
            tx: number;
        };
    };
    audio: {
        echoCancellation: {
            enabled: boolean;
            taps: number;
            nlp: boolean;
        };
        gainControl: {
            enabled: boolean;
            targetLevel: number;
            maxGain: number;
        };
        dtmfDetection: {
            useHardware: boolean;
            minDuration: number;
            threshold: number;
        };
    };
    debug: {
        logHardware: boolean;
        logAudio: boolean;
        traceDahdi: boolean;
    };
    monitorInterval?: number;
}

export interface AudioConfig {
    sampleRate: number;
    channels: number;
    bitDepth: number;
    bufferSize: number;
    vadThreshold: number;
    silenceThreshold: number;
    noiseReduction?: boolean;
    echoCancellation?: boolean;
}
