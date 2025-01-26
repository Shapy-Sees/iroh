// src/config/fxs.config.ts
//
// FXS hardware configuration for DAHDI integration
// This file defines all the necessary parameters for configuring
// the FXS ports on our OpenVox A400P card through DAHDI.
// It includes audio settings, signaling parameters, and hardware options.

import { config } from 'dotenv';
import { ConfigurationError } from '../types/core';

// Load environment variables
config();

// Let's define our FXS hardware configuration interface
export interface FXSConfig {
    /** DAHDI device path for the FXS channel */
    devicePath: string;
    
    /** Sample rate in Hz - DAHDI requires 8000 */
    sampleRate: number;
    
    /** Channel-specific options */
    channel?: {
        /** Channel number in DAHDI (1-based) */
        number: number;
        
        /** Ring cadence in ms (on/off pairs) */
        ringCadence: number[];
        
        /** Caller ID format */
        callerIdFormat: 'bell' | 'v23' | 'dtmf';
        
        /** Line impedance in ohms */
        impedance: 600 | 900;
    };

    /** Audio processing options */
    audio?: {
        /** Echo cancellation settings */
        echoCancellation: {
            enabled: boolean;
            /** Number of taps for echo canceller */
            taps: number;
        };
        
        /** Automatic gain control */
        gainControl: {
            enabled: boolean;
            targetLevel: number;
        };
        
        /** DTMF detection settings */
        dtmfDetection: {
            /** Use hardware DTMF detection if available */
            useHardware: boolean;
            /** Minimum duration for valid DTMF tone (ms) */
            minDuration: number;
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
    };
}

// Validation function for the configuration
export function validateFXSConfig(config: FXSConfig): string[] {
    const errors: string[] = [];

    // Check DAHDI device path
    if (!config.devicePath?.startsWith('/dev/dahdi/')) {
        errors.push('Device path must be a valid DAHDI device path');
    }

    // Validate sample rate - DAHDI requires 8kHz
    if (config.sampleRate !== 8000) {
        errors.push('Sample rate must be 8000Hz for DAHDI compatibility');
    }

    // Validate channel configuration if provided
    if (config.channel) {
        if (config.channel.number < 1) {
            errors.push('Channel number must be positive');
        }

        if (!Array.isArray(config.channel.ringCadence) || 
            config.channel.ringCadence.length % 2 !== 0) {
            errors.push('Ring cadence must be an array with even number of elements');
        }

        if (![600, 900].includes(config.channel.impedance)) {
            errors.push('Line impedance must be either 600 or 900 ohms');
        }
    }

    // Validate audio settings if provided
    if (config.audio?.echoCancellation) {
        if (config.audio.echoCancellation.taps < 32 || 
            config.audio.echoCancellation.taps > 1024) {
            errors.push('Echo cancellation taps must be between 32 and 1024');
        }
    }

    return errors;
}

// Default configuration for OpenVox A400P FXS ports
export const fxsConfig: FXSConfig = {
    devicePath: process.env.FXS_DEVICE_PATH || '/dev/dahdi/channel001',
    sampleRate: 8000,
    
    channel: {
        number: Number(process.env.FXS_CHANNEL) || 1,
        ringCadence: [2000, 4000], // 2s on, 4s off
        callerIdFormat: 'bell',
        impedance: 600
    },

    audio: {
        echoCancellation: {
            enabled: true,
            taps: 128
        },
        gainControl: {
            enabled: true,
            targetLevel: -15  // dB
        },
        dtmfDetection: {
            useHardware: true,
            minDuration: 40   // ms
        }
    },

    debug: {
        logHardware: process.env.NODE_ENV === 'development',
        logAudio: false,
        traceDahdi: process.env.NODE_ENV === 'development'
    }
};

// Helper function to merge custom config with defaults
export function createFXSConfig(
    customConfig: Partial<FXSConfig>
): FXSConfig {
    const merged = {
        ...fxsConfig,
        ...customConfig,
        // Deep merge channel config if provided
        channel: customConfig.channel ? {
            ...fxsConfig.channel,
            ...customConfig.channel
        } : fxsConfig.channel,
        // Deep merge audio config if provided
        audio: customConfig.audio ? {
            ...fxsConfig.audio,
            ...customConfig.audio,
            echoCancellation: {
                ...fxsConfig.audio?.echoCancellation,
                ...customConfig.audio?.echoCancellation
            },
            gainControl: {
                ...fxsConfig.audio?.gainControl,
                ...customConfig.audio?.gainControl
            },
            dtmfDetection: {
                ...fxsConfig.audio?.dtmfDetection,
                ...customConfig.audio?.dtmfDetection
            }
        } : fxsConfig.audio
    };

    // Validate the merged configuration
    const errors = validateFXSConfig(merged);
    if (errors.length > 0) {
        throw new Error(
            `Invalid FXS configuration:\n${errors.map(e => `- ${e}`).join('\n')}`
        );
    }

    return merged;
}

// Export helper types for configuration
export interface FXSChannelConfig {
    /** Channel number in DAHDI (1-based) */
    number: number;
    
    /** Ring cadence in ms (on/off pairs) */
    ringCadence: number[];
    
    /** Caller ID format */
    callerIdFormat: 'bell' | 'v23' | 'dtmf';
    
    /** Line impedance in ohms */
    impedance: 600 | 900;
}

export type FXSAudioConfig = Required<FXSConfig>['audio'];
export type FXSDebugConfig = Required<FXSConfig>['debug'];