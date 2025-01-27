// src/types/hardware/dahdi.ts
//
// Type definitions for DAHDI (Digium Asterisk Hardware Device Interface)
// Contains all the core types needed for DAHDI hardware interaction

import { Buffer } from 'buffer';
import { AudioInput } from './audio';

// Base hardware error class
export class HardwareError extends Error {
    constructor(message: string, public details?: Record<string, any>) {
        super(message);
        this.name = 'HardwareError';
    }
}

export class DAHDIError extends HardwareError {
    constructor(message: string, details?: Record<string, any>) {
        super(message, { ...details, source: 'DAHDI' });
    }
}

export class DAHDIFormatError extends HardwareError {
    constructor(message: string, public details: string[]) {
        super(message);
        this.name = 'DAHDIFormatError';
    }
}

// Core DAHDI configuration interface
export interface DAHDIConfig {
    /** Path to DAHDI device */
    devicePath: string;
    
    /** Path to DAHDI control interface */
    controlPath: string;
    
    /** Sample rate - DAHDI requires 8000 Hz */
    sampleRate: 8000;
    
    /** Number of channels - DAHDI requires mono */
    channels: 1;
    
    /** Bit depth - DAHDI requires 16-bit */
    bitDepth: 16;
    
    /** Buffer size in bytes */
    bufferSize: number;
    
    /** DAHDI channel number */
    channel: number;
    
    /** Status monitoring interval in ms */
    monitorInterval?: number;
}

// Channel configuration
export interface DAHDIChannelConfig {
    /** Channel number */
    channel: number;
    
    /** Signaling type */
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
    
    /** Line impedance in ohms */
    impedance: 600 | 900;
}

// Audio format requirements
export interface DAHDIAudioFormat {
    /** Sample rate must be 8000 Hz */
    sampleRate: 8000;
    
    /** Must be mono */
    channels: 1;
    
    /** Must be 16-bit */
    bitDepth: 16;
    
    /** Linear PCM format */
    format: 'linear';
}

// Buffer information for audio handling
export interface DAHDIBufferInfo {
    /** Total buffer size in bytes */
    size: number;
    
    /** Number of blocks */
    blocks: number;
    
    /** Size of each block */
    blocksize: number;
    
    /** Number of queued blocks */
    queued: number;
}

// Channel status information
export interface DAHDIChannelStatus {
    /** Whether channel is open */
    isOpen: boolean;
    
    /** Channel number */
    channel: number;
    
    /** Alarm state */
    alarms: number;
    
    /** Signaling information */
    signaling: {
        type: string;
        hookstate: 'onhook' | 'offhook';
        ringing: boolean;
    };
    
    /** Audio levels */
    levels?: {
        rxLevel: number;
        txLevel: number;
    };
}

// IOCTL commands
export enum DAHDIIOCtl {
    GET_PARAMS = 0x40045700,
    SET_PARAMS = 0x40045701,
    DIAL = 0x40045702,
    RING_ON = 0x40045703,
    RING_OFF = 0x40045704,
    GET_BUFINFO = 0x40045705,
    SET_BUFINFO = 0x40045706,
    EC_ENABLE = 0x40045707,
    EC_DISABLE = 0x40045708
}

// Types for events
export interface DAHDIEvents {
    'ready': void;
    'error': Error;
    'audio': AudioInput;
    'hook_state': { offHook: boolean };
    'ring_start': void;
    'ring_stop': void;
    'dtmf': { digit: string; duration: number };
}

// Add AudioConverterOptions
export interface AudioConverterOptions {
    bufferSize?: number;
    format?: Partial<DAHDIAudioFormat>;
}