// src/config/dahdi.ts
//
// DAHDI configuration management that handles the configuration and validation
// of DAHDI hardware settings. This includes channel configuration, audio parameters,
// and hardware-specific options for the OpenVox A400P FXS card.

import { z } from 'zod';
import { config as dotenvConfig } from 'dotenv';
import { logger } from '../utils/logger';
import { 
    DAHDIConfig, 
    DAHDIChannelConfig, 
    DAHDIAudioFormat 
} from '../types/dahdi';

// Load environment variables
dotenvConfig();

// Define constants that were previously missing
const DAHDI_TIMEOUTS = {
    RING: 2000,        // Ring duration in ms
    DTMF: 40,         // DTMF detection minimum duration in ms
    ECHO_CANCEL: 128,  // Echo cancellation taps
    BUFFER: 20        // Audio buffer size in ms
} as const;

// Hardware constants
const DAHDI_CONSTANTS = {
    DEVICE_PATH: '/dev/dahdi/channel',
    CONTROL_PATH: '/dev/dahdi/ctl',
    LOADZONE: 'us',
    DEFAULT_ZONE: 'us',
    LINE_IMPEDANCE: 600,  // Standard line impedance
    FXS_VOLTAGE: 48,     // FXS port voltage
    RING_VOLTAGE: 90,    // Ring voltage
    MAX_CHANNELS: 32,    // Maximum channels per span
    MIN_BUFFER_SIZE: 32, // Minimum buffer size (samples)
    MAX_BUFFER_SIZE: 8192, // Maximum buffer size (samples)
    EC_TAPS: 128        // Default echo cancellation taps
} as const;

// Define DAHDI hardware configuration interface
interface DAHDIHardwareConfig {
    /** Path to DAHDI device */
    devicePath: string;
    
    /** Sample rate - DAHDI requires 8000 Hz */
    sampleRate: number;
    
    /** Channel configuration */
    channel?: {
        /** Channel number (1-based) */
        number: number;
        
        /** Ring cadence in milliseconds (on/off pairs) */
        ringCadence: number[];
        
        /** Caller ID format */
        callerIdFormat: 'bell' | 'v23' | 'dtmf';
        
        /** Line impedance (600Ω or 900Ω only) */
        impedance: 600 | 900;
        
        /** Audio gain settings */
        gain?: {
            /** Receive gain (-12 to 12 dB) */
            rx: number;
            /** Transmit gain (-12 to 12 dB) */
            tx: number;
        };
    };

    /** Audio processing configuration */
    audio?: {
        /** Echo cancellation settings */
        echoCancellation: {
            /** Enable echo cancellation */
            enabled: boolean;
            /** Number of taps (32-1024) */
            taps: number;
            /** Non-linear processing */
            nlp: boolean;
        };
        
        /** Automatic gain control */
        gainControl: {
            /** Enable AGC */
            enabled: boolean;
            /** Target level in dB */
            targetLevel: number;
            /** Maximum gain in dB */
            maxGain: number;
        };
        
        /** DTMF detection configuration */
        dtmfDetection: {
            /** Use hardware DTMF detection */
            useHardware: boolean;
            /** Minimum duration for valid DTMF */
            minDuration: number;
            /** Detection threshold */
            threshold: number;
        };
    };

    /** Debug options */
    debug?: {
        /** Enable hardware logging */
        logHardware: boolean;
        /** Log audio data */
        logAudio: boolean;
        /** Trace DAHDI operations */
        traceDahdi: boolean;
    };
}

// Validation schema using Zod
const DAHDIConfigSchema = z.object({
    devicePath: z.string().startsWith('/dev/dahdi/'),
    sampleRate: z.literal(8000),
    
    channel: z.object({
        number: z.number().min(1),
        ringCadence: z.array(z.number()).min(2),
        callerIdFormat: z.enum(['bell', 'v23', 'dtmf']),
        impedance: z.union([z.literal(600), z.literal(900)]),
        gain: z.object({
            rx: z.number().min(-12).max(12),
            tx: z.number().min(-12).max(12)
        }).optional()
    }).optional(),

    audio: z.object({
        echoCancellation: z.object({
            enabled: z.boolean(),
            taps: z.number().min(32).max(1024),
            nlp: z.boolean()
        }),
        gainControl: z.object({
            enabled: z.boolean(),
            targetLevel: z.number(),
            maxGain: z.number()
        }),
        dtmfDetection: z.object({
            useHardware: z.boolean(),
            minDuration: z.number().min(20).max(500),
            threshold: z.number()
        })
    }).optional(),

    debug: z.object({
        logHardware: z.boolean(),
        logAudio: z.boolean(),
        traceDahdi: z.boolean()
    }).optional()
});

// Validation function for the configuration
export function validateDAHDIConfig(config: DAHDIHardwareConfig): string[] {
    const errors: string[] = [];

    try {
        DAHDIConfigSchema.parse(config);
    } catch (error) {
        if (error instanceof z.ZodError) {
            errors.push(...error.errors.map(err => err.message));
        }
    }

    // Additional hardware-specific validation
    if (config.audio?.echoCancellation.enabled) {
        if (config.audio.echoCancellation.taps % 32 !== 0) {
            errors.push('Echo cancellation taps must be a multiple of 32');
        }
    }

    if (config.channel?.ringCadence) {
        if (config.channel.ringCadence.length % 2 !== 0) {
            errors.push('Ring cadence must have an even number of entries (on/off pairs)');
        }
    }

    return errors;
}

// Default DAHDI configuration
export const dahdiConfig: DAHDIHardwareConfig = {
    devicePath: process.env.DAHDI_DEVICE_PATH || `${DAHDI_CONSTANTS.DEVICE_PATH}/channel001`,
    sampleRate: 8000, // DAHDI requires 8kHz
    
    channel: {
        number: Number(process.env.DAHDI_CHANNEL) || 1,
        ringCadence: [2000, 4000], // 2s on, 4s off
        callerIdFormat: 'bell',
        impedance: DAHDI_CONSTANTS.LINE_IMPEDANCE as 600 | 900,
        gain: {
            rx: 0,
            tx: 0
        }
    },

    audio: {
        echoCancellation: {
            enabled: true,
            taps: DAHDI_CONSTANTS.EC_TAPS,
            nlp: true
        },
        gainControl: {
            enabled: true,
            targetLevel: -15, // dB
            maxGain: 12
        },
        dtmfDetection: {
            useHardware: true,
            minDuration: DAHDI_TIMEOUTS.DTMF,
            threshold: 0.25
        }
    },

    debug: {
        logHardware: process.env.NODE_ENV === 'development',
        logAudio: false,
        traceDahdi: process.env.NODE_ENV === 'development'
    }
};

// Helper function to create configuration
export function createDAHDIConfig(
    customConfig: Partial<DAHDIHardwareConfig>
): DAHDIHardwareConfig {
    const merged = {
        ...dahdiConfig,
        ...customConfig,
        // Deep merge channel config if provided
        channel: customConfig.channel ? {
            ...dahdiConfig.channel,
            ...customConfig.channel
        } : dahdiConfig.channel,
        // Deep merge audio config if provided
        audio: customConfig.audio ? {
            ...dahdiConfig.audio,
            ...customConfig.audio,
            echoCancellation: {
                ...dahdiConfig.audio?.echoCancellation,
                ...customConfig.audio?.echoCancellation
            },
            gainControl: {
                ...dahdiConfig.audio?.gainControl,
                ...customConfig.audio?.gainControl
            },
            dtmfDetection: {
                ...dahdiConfig.audio?.dtmfDetection,
                ...customConfig.audio?.dtmfDetection
            }
        } : dahdiConfig.audio
    };

    // Validate the merged configuration
    const errors = validateDAHDIConfig(merged);
    if (errors.length > 0) {
        const errorMessage = `Invalid DAHDI configuration:\n${errors.map(e => `- ${e}`).join('\n')}`;
        logger.error(errorMessage);
        throw new Error(errorMessage);
    }

    return merged;
}

// Export helper types for configuration
export type DAHDIChannelConfig = Required<DAHDIHardwareConfig>['channel'];
export type DAHDIAudioConfig = Required<DAHDIHardwareConfig>['audio'];
export type DAHDIDebugConfig = Required<DAHDIHardwareConfig>['debug'];

// Export constants
export { DAHDI_TIMEOUTS, DAHDI_CONSTANTS };