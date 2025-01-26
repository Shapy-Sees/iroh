// src/types/hardware/fxs.ts
//
// Type definitions for FXS (Foreign Exchange Station) hardware configuration
// Provides type safety for FXS-specific settings while maintaining
// compatibility with DAHDI requirements

import { DAHDIConfig, DAHDIChannelConfig } from './dahdi';

export interface FXSConfig {
    /** DAHDI device configuration */
    fxs: {
        /** Path to DAHDI device */
        devicePath: string;
        /** Fixed sample rate for DAHDI (8000 Hz) */
        sampleRate: 8000;
        /** Optional line impedance (600Ω or 900Ω) */
        impedance?: number;
        /** Channel number */
        channel?: number;
    };
    /** Audio processing configuration */
    audio: {
        /** Buffer size in bytes */
        bufferSize: number;
        /** Fixed mono channel count */
        channels: 1;
        /** Fixed 16-bit depth */
        bitDepth: 16;
        /** Voice activity detection threshold */
        vadThreshold?: number;
    };
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