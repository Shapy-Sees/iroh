// src/types/dahdi.ts
//
// Type definitions for DAHDI (Digium Asterisk Hardware Device Interface)
// Provides type safety and documentation for all DAHDI-related interfaces
// used throughout the project. These types ensure consistency between
// hardware interaction, configuration, and audio processing components.

import { Buffer } from 'buffer';

// Core DAHDI configuration interface
export interface DAHDIConfig {
    /** Path to DAHDI device (e.g., /dev/dahdi/channel001) */
    devicePath: string;
    /** Path to DAHDI control interface */
    controlPath: string;
    /** Sample rate - must be 8000 Hz for DAHDI */
    sampleRate: 8000;
    /** Number of channels - must be 1 (mono) for DAHDI */
    channels: 1;
    /** Bit depth - must be 16-bit for DAHDI */
    bitDepth: 16;
    /** Buffer size in bytes (should be multiple of 160) */
    bufferSize: number;
    /** DAHDI channel number */
    channel: number;
    /** Status monitoring interval in ms */
    monitorInterval?: number;
}

// DAHDI channel configuration
export interface DAHDIChannelConfig {
    /** Channel number in DAHDI (1-based) */
    channel: number;
    /** Signaling type for FXS ports */
    signaling: 'fxs_ls' | 'fxs_gs' | 'fxs_ks';
    /** Echo cancellation settings */
    echocancel?: {
        enabled: boolean;
        taps: number;
    };
    /** Caller ID configuration */
    callerid?: {
        enabled: boolean;
        format: 'bell' | 'v23' | 'dtmf';
    };
    /** Line impedance (600Ω or 900Ω) */
    impedance: 600 | 900;
}

// DAHDI audio format specification
export interface DAHDIAudioFormat {
    /** Sample rate must be 8000 Hz */
    readonly sampleRate: 8000;
    /** DAHDI only supports mono */
    readonly channels: 1;
    /** DAHDI uses 16-bit linear PCM */
    readonly bitDepth: 16;
    /** Linear PCM format specifier */
    readonly format: 'linear';
}

// Channel status information
export interface DAHDIChannelStatus {
    /** Whether channel is open and active */
    isOpen: boolean;
    /** Channel number */
    channel: number;
    /** Current alarm state (bit field) */
    alarms: number;
    /** Signaling status */
    signaling: {
        type: string;
        hookstate: 'onhook' | 'offhook';
        ringing: boolean;
    };
    /** Audio levels if available */
    levels?: {
        rxLevel: number;
        txLevel: number;
    };
}

// Buffer information for DAHDI audio
export interface DAHDIBufferInfo {
    /** Total buffer size in bytes */
    size: number;
    /** Number of buffer blocks */
    blocks: number;
    /** Size of each block in bytes */
    blocksize: number;
    /** Number of queued blocks */
    queued: number;
}

// DAHDI-specific error class
export class DAHDIError extends Error {
    constructor(
        message: string,
        public readonly cause?: Error
    ) {
        super(message);
        this.name = 'DAHDIError';
    }
}

// Audio format conversion error
export class AudioFormatError extends Error {
    constructor(
        message: string,
        public readonly details: string[]
    ) {
        super(message);
        this.name = 'AudioFormatError';
    }
}

// DAHDI IOCTLs - these would be defined in native binding
export enum DAHDIIOCtl {
    GET_PARAMS = 0x40045700,
    SET_PARAMS = 0x40045701,
    DIAL = 0x40045702,
    RING_ON = 0x40045703,
    RING_OFF = 0x40045704,
    GET_BUFINFO = 0x40045705,
    SET_BUFINFO = 0x40045706,
    EC_ENABLE = 0x40045707,
    EC_DISABLE = 0x40045708,
    SET_DTMF_MODE = 0x40045709
}

// Events emitted by DAHDI interface
export interface DAHDIEvents {
    'ready': void;
    'error': Error;
    'audio': AudioInput;
    'hook_state': { offHook: boolean };
    'ring_start': void;
    'ring_stop': void;
    'dtmf': { digit: string; duration: number };
    'alarm': number;
}

// Input audio format
export interface AudioInput {
    sampleRate: number;
    channels: number;
    bitDepth: number;
    data: Buffer;
}