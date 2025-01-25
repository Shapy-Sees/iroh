// src/types/dahdi.ts
//
// Type definitions for interacting with DAHDI (Digium Asterisk Hardware Device Interface)
// These types provide a strongly-typed interface for working with DAHDI hardware
// and configuring telephony channels.


// DAHDI device channel configuration
export interface DAHDIChannelConfig {
    /** Channel number (1-based) */
    channel: number;
    
    /** Signaling type (e.g., 'fxs_ls' for loopstart FXS) */
    signaling: DAHDISignalingType;
    
    /** Echo cancellation configuration */
    echocancel?: {
        enabled: boolean;
        taps?: number;  // Length of echo canceller in taps (32-1024)
    };
    
    /** Caller ID configuration */
    callerid?: {
        enabled: boolean;
        format?: 'bell' | 'v23' | 'dtmf';
    };
    
    /** Impedance setting for the channel */
    impedance?: 600 | 900;  // Common impedance values in ohms
}

// Valid DAHDI signaling types
export type DAHDISignalingType = 
    | 'fxs_ls'  // FXS Loopstart
    | 'fxs_gs'  // FXS Groundstart
    | 'fxs_ks'  // FXS Kewlstart
    | 'unused'; // Unconfigured channel

// DAHDI span (card) configuration
export interface DAHDISpanConfig {
    /** Span number (1-based) */
    span: number;
    
    /** Timing source priority (0 = disabled, 1-n = priority) */
    timing: number;
    
    /** Line build out (signal boost) in dB */
    lbo?: number;
    
    /** Frame format (esf/d4/ccs/cas) */
    framing?: string;
    
    /** Line coding (ami/b8zs/hdb3) */
    coding?: string;
    
    /** Channels associated with this span */
    channels: DAHDIChannelConfig[];
}

export interface DAHDIReadStream extends NodeJS.ReadableStream {
    // Add DAHDI-specific properties
    channel: number;
    readAudio(): Promise<Buffer>;
}

// DAHDI system configuration
export interface DAHDISystemConfig {
    /** System-wide echo canceller configuration */
    echocancel: {
        enabled: boolean;
        taps?: number;
    };
    
    /** Loading zones for tones (e.g., 'us', 'uk', etc.) */
    loadzone: string[];
    
    /** Default zone for tones */
    defaultzone: string;
    
    /** Spans (cards) in the system */
    spans: DAHDISpanConfig[];
}

// DAHDI hardware info
export interface DAHDIHardwareInfo {
    /** Device name (e.g., "OpenVox A400P") */
    name: string;
    
    /** Device location (e.g., "PCI 0000:00:1f.0") */
    location: string;
    
    /** Number of spans on device */
    spans: number;
    
    /** Number of channels per span */
    channelsPerSpan: number;
    
    /** Hardware manufacturer ID */
    manufacturer: string;
    
    /** Hardware capabilities bitmask */
    capabilities: number;
}

// DAHDI channel status
export interface DAHDIChannelStatus {
    /** Channel number */
    channel: number;
    
    /** Whether channel is ready for use */
    initialized: boolean;
    
    /** Whether channel is currently in use */
    active: boolean;
    
    /** Current signaling state */
    signaling: {
        /** Hook state (on/off hook) */
        hookstate: 'onhook' | 'offhook';
        
        /** Ring indicator */
        ringing: boolean;
        
        /** Received caller ID */
        callerid?: string;
    };
    
    /** Audio level measurements */
    levels: {
        /** Receive level in dB */
        rx: number;
        
        /** Transmit level in dB */
        tx: number;
    };
    
    /** Error conditions if any */
    errors?: {
        code: number;
        message: string;
    }[];
}

// DAHDI statistics
export interface DAHDIStats {
    /** Number of active channels */
    activeChannels: number;
    
    /** Total frames processed */
    frames: number;
    
    /** Frame errors detected */
    frameErrors: number;
    
    /** CRC errors detected */
    crcErrors: number;
    
    /** Number of times buffer underran */
    underruns: number;
    
    /** Number of times buffer overran */
    overruns: number;
}

// DAHDI audio format specification
export interface DAHDIAudioFormat {
    /** Sample rate in Hz */
    sampleRate: 8000;  // DAHDI only supports 8kHz
    
    /** Number of channels */
    channels: 1;       // DAHDI uses mono audio
    
    /** Sample format */
    format: 'linear' | 'alaw' | 'ulaw';
    
    /** Bits per sample */
    bitDepth: 16;      // DAHDI uses 16-bit samples
}

// IOCTL commands for DAHDI device control
export const DAHDIIOCtl = {
    /** Get/set channel parameters */
    GET_PARAMS: 0x40045700,
    SET_PARAMS: 0x40045701,
    
    /** Audio control */
    AUDIO_GAIN: 0x40045702,
    AUDIO_TONES: 0x40045703,
    
    /** Channel state */
    GET_CHANNO: 0x40045704,
    GET_BUFINFO: 0x40045705,
    
    /** Signaling operations */
    DIAL: 0x40045706,
    HOOK: 0x40045707,
    RING: 0x40045708,
    
    /** Echo cancellation */
    EC_DISABLE: 0x40045709,
    EC_ENABLE: 0x4004570a,
    
    /** Tone detection */
    SET_DTMF_MODE: 0x4004570b,
    GET_DTMF_MODE: 0x4004570c
} as const;

// Buffer information structure
export interface DAHDIBufferInfo {
    /** Total size of buffer in bytes */
    size: number;
    
    /** Number of blocks in buffer */
    blocks: number;
    
    /** Size of each block in bytes */
    blocksize: number;
    
    /** Number of blocks currently queued */
    queued: number;
}

// Error codes that can be returned by DAHDI operations
export enum DAHDIErrorCode {
    /** No error occurred */
    SUCCESS = 0,
    
    /** Device is busy or unavailable */
    BUSY = -16,
    
    /** Invalid parameter provided */
    INVALID_PARAM = -22,
    
    /** Operation not permitted */
    NOT_PERMITTED = -1,
    
    /** No such device exists */
    NO_DEVICE = -19,
    
    /** Device or resource busy */
    RESOURCE_BUSY = -16,
    
    /** Operation timed out */
    TIMEOUT = -110,
    
    /** I/O error occurred */
    IO_ERROR = -5,
    
    /** Operation would block */
    WOULD_BLOCK = -11
}