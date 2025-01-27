import { BaseConfig } from './core';
import { DAHDI_CONSTANTS } from '../config/constants';

export enum HardwareState {
    INITIALIZING = 'initializing',
    READY = 'ready',
    ERROR = 'error',
    OFFLINE = 'offline'
}

export interface HardwareConfig extends BaseConfig {
    dahdi: DAHDIConfig;
    audio: AudioConfig;
}

export interface DAHDIConfig {
    devicePath: string;
    sampleRate: typeof DAHDI_CONSTANTS.SAMPLE_RATE;
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
}

export interface AudioConfig {
    sampleRate: number;
    channels: number;
    bitDepth: number;
    bufferSize: number;
}
