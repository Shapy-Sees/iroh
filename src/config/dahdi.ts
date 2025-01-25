// src/config/dahdi.ts
//
// DAHDI configuration management that provides:
// - Type-safe configuration options
// - Hardware settings validation
// - Channel configuration
// - Audio parameters
// - Signaling options
// - Default configurations
// - Helpful error messages

import { z } from 'zod';
import { config } from 'dotenv';
import { 
    DEFAULTS,
    DAHDI_ALARMS,
    DAHDI_COMMANDS 
} from '../core/constants';
import { logger } from '../utils/logger';

// Load environment variables
config();

// Define DAHDI hardware configuration interface with detailed options
export interface DAHDIHardwareConfig {
    /** Path to DAHDI device (e.g., /dev/dahdi/channel001) */
    devicePath: string;
    
    /** Sample rate - DAHDI requires 8000 Hz */
    sampleRate: number;
    
    /** Channel configuration options */
    channel?: {
        /** Channel number in DAHDI (1-based) */
        number: number;
        
        /** Ring cadence in milliseconds (on/off pairs) */
        ringCadence: number[];
        
        /** Caller ID format for FXS ports */
        callerIdFormat: 'bell' | 'v23' | 'dtmf';
        
        /** Line impedance in ohms (600/900) */
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
            /** Whether echo cancellation is enabled */
            enabled: boolean;
            /** Number of taps for echo canceller (32-1024) */
            taps: number;
            /** Non-linear processing mode */
            nlp: boolean;
        };
        
        /** Automatic gain control */
        gainControl: {
            /** Whether AGC is enabled */
            enabled: boolean;
            /** Target audio level in dB */
            targetLevel: number;
            /** Maximum gain in dB */
            maxGain: number;
        };
        
        /** DTMF detection configuration */
        dtmfDetection: {
            /** Use hardware DTMF detection if available */
            useHardware: boolean;
            /** Minimum duration for valid DTMF (ms) */
            minDuration: number;
            /** Minimum power for valid DTMF */
            threshold: number;
        };

        /** Buffer configuration */
        buffering: {
            /** Buffer size in frames */
            size: number;
            /** Number of buffers */
            count: number;
            /** Policy for buffer overruns */
            overrunPolicy: 'drop' | 'block';
        };
    };

    /** Signaling configuration */
    signaling?: {
        /** Signaling type for FXS ports */
        type: 'fxs_ls' | 'fxs_gs' | 'fxs_ks';
        /** Timeout for dial tone (ms) */
        dialTimeout: number;
        /** Timeout for digit collection (ms) */
        digitTimeout: number;
        /** Ring timeout (ms) */
        ringTimeout: number;
    };

    /** System configuration */
    system?: {
        /** System clock source priority */
        timing: number;
        /** Line build out (dB) */
        buildout: number;
        /** Alarm configuration */
        alarms: {
            /** Enabled alarm types */
            enabled: number;
            /** Auto-recovery enabled */
            autoRecover: boolean;
            /** Recovery timeout (ms) */
            recoveryTimeout: number;
        };
    };

    /** Debug options */
    debug?: {
        /** Enable detailed hardware logging */
        logHardware: boolean;
        /** Log raw audio data */
        logAudio: boolean;
        /** Trace DAHDI operations */
        traceDahdi: boolean;
        /** Log buffer statistics */
        logBufferStats: boolean;
    };
}

// Validation schema for DAHDI configuration
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
        }),
        buffering: z.object({
            size: z.number().min(32).max(8192),
            count: z.number().min(2).max(32),
            overrunPolicy: z.enum(['drop', 'block'])
        })
    }).optional(),

    signaling: z.object({
        type: z.enum(['fxs_ls', 'fxs_gs', 'fxs_ks']),
        dialTimeout: z.number().min(1000),
        digitTimeout: z.number().min(100),
        ringTimeout: z.number().min(1000)
    }).optional(),

    system: z.object({
        timing: z.number(),
        buildout: z.number(),
        alarms: z.object({
            enabled: z.number(),
            autoRecover: z.boolean(),
            recoveryTimeout: z.number()
        })
    }).optional(),

    debug: z.object({
        logHardware: z.boolean(),
        logAudio: z.boolean(),
        traceDahdi: z.boolean(),
        logBufferStats: z.boolean()
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

// Default DAHDI configuration for OpenVox A400P FXS ports
export const dahdiConfig: DAHDIHardwareConfig = {
    devicePath: process.env.DAHDI_DEVICE_PATH || DEFAULTS.DAHDI.DEVICE_PATH + '/channel001',
    sampleRate: DEFAULTS.AUDIO.SAMPLE_RATE,
    
    channel: {
        number: Number(process.env.DAHDI_CHANNEL) || 1,
        ringCadence: [2000, 4000], // 2s on, 4s off
        callerIdFormat: 'bell',
        impedance: DEFAULTS.DAHDI.LINE_IMPEDANCE,
        gain: {
            rx: 0,
            tx: 0
        }
    },

    audio: {
        echoCancellation: {
            enabled: true,
            taps: DEFAULTS.DAHDI.EC_TAPS || 128,
            nlp: true
        },
        gainControl: {
            enabled: true,
            targetLevel: -15, // dB
            maxGain: 12
        },
        dtmfDetection: {
            useHardware: true,
            minDuration: TIMEOUTS.DTMF,
            threshold: 0.25
        },
        buffering: {
            size: DEFAULTS.AUDIO.BUFFER_SIZE,
            count: DEFAULTS.AUDIO.BLOCKS,
            overrunPolicy: 'drop'
        }
    },

    signaling: {
        type: 'fxs_ls', // Loop start
        dialTimeout: 30000, // 30 seconds
        digitTimeout: 5000,  // 5 seconds
        ringTimeout: 2000    // 2 seconds
    },

    system: {
        timing: 0, // Use internal timing
        buildout: 0, // 0dB attenuation
        alarms: {
            enabled: DAHDI_ALARMS.RED | DAHDI_ALARMS.YELLOW | DAHDI_ALARMS.BLUE,
            autoRecover: true,
            recoveryTimeout: 5000 // 5 seconds
        }
    },

    debug: {
        logHardware: process.env.NODE_ENV === 'development',
        logAudio: false,
        traceDahdi: process.env.NODE_ENV === 'development',
        logBufferStats: process.env.NODE_ENV === 'development'
    }
};

// Helper function to merge custom config with defaults
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
            },
            buffering: {
                ...dahdiConfig.audio?.buffering,
                ...customConfig.audio?.buffering
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
export type DAHDISignalingConfig = Required<DAHDIHardwareConfig>['signaling'];
export type DAHDISystemConfig = Required<DAHDIHardwareConfig>['system'];
export type DAHDIDebugConfig = Required<DAHDIHardwareConfig>['debug'];