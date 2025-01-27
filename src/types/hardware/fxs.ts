// src/types/hardware/fxs.ts
//
// Type definitions for FXS (Foreign Exchange Station) hardware configuration
// Provides type safety for FXS-specific settings while maintaining
// compatibility with DAHDI requirements

import { DAHDIConfig, DAHDIChannelConfig } from './dahdi';
import { AudioConfig } from './audio';

export interface FXSConfig {
    /** DAHDI device configuration */
    fxs: Omit<DAHDIConfig, 'controlPath'> & {
        /** Optional line impedance (600Ω or 900Ω) */
        impedance?: 600 | 900;
    };
    /** Audio processing configuration */
    audio: AudioConfig;
    /** AI service configuration */
    ai?: {
        /** AI model identifier */
        model?: string;
        /** API key */
        apiKey?: string;
        /** Temperature for response generation */
        temperature?: number;
    };
}

export interface FXSChannelStatus {
    isOpen: boolean;
    voltage?: number;
    impedance?: number;
    alarms?: number;
    lastError?: Error;
}

// Validation function
export function validateFXSConfig(config: FXSConfig): string[] {
    const errors: string[] = [];

    // Validate DAHDI requirements
    if (config.fxs.sampleRate !== 8000) {
        errors.push('Sample rate must be 8000Hz for DAHDI compatibility');
    }

    if (config.audio.channels !== 1) {
        errors.push('Only mono audio is supported');
    }

    if (config.audio.bitDepth !== 16) {
        errors.push('Bit depth must be 16-bit');
    }

    // Validate FXS-specific settings
    if (config.fxs.impedance && ![600, 900].includes(config.fxs.impedance)) {
        errors.push('FXS impedance must be either 600Ω or 900Ω');
    }

    return errors;
}