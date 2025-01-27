// src/config/dahdi.ts
//
// DAHDI configuration management that handles the configuration and validation
// of DAHDI hardware settings. This includes channel configuration, audio parameters,
// and hardware-specific options for the OpenVox A400P FXS card.

import { z } from 'zod';
import { config as dotenvConfig } from 'dotenv';
import { logger } from '../utils/logger';
import { DAHDI_CONSTANTS, DAHDI_TIMEOUTS } from './constants';
import { HardwareConfig } from '../types/core';

// Load environment variables
dotenvConfig();

// Use only hardware-specific validation
export function validateDAHDIConfig(config: HardwareConfig['dahdi']): string[] {
    const errors: string[] = [];

    if (!config.device?.startsWith('/dev/dahdi/')) {
        errors.push('Device path must be a valid DAHDI device path');
    }

    if (config.echocanceltaps % 32 !== 0) {
        errors.push('Echo cancellation taps must be a multiple of 32');
    }

    // ...additional hardware-specific validation...

    return errors;
}

// Default DAHDI configuration
export const dahdiConfig: HardwareConfig['dahdi'] = {
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
    customConfig: Partial<HardwareConfig['dahdi']>
): HardwareConfig['dahdi'] {
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

// Export constants
export { DAHDI_CONSTANTS, DAHDI_TIMEOUTS };