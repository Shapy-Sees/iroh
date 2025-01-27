// src/config/constants.ts

export const DAHDI_CONSTANTS = {
    DEVICE_PATH: '/dev/dahdi',
    EC_TAPS: 128,
    LINE_IMPEDANCE: 600,
    MAX_CHANNELS: 24,
    SAMPLE_RATE: 8000,
    BITS_PER_SAMPLE: 16
} as const;

export const DAHDI_TIMEOUTS = {
    DTMF: 40,      // ms
    RING: 2000,    // ms
    FLASH: 750,    // ms
    WINK: 150      // ms
} as const;

export const AUDIO_CONSTANTS = {
    SAMPLE_RATES: [8000, 16000, 44100, 48000],
    CHANNELS: [1, 2],
    BIT_DEPTHS: [16, 24, 32],
    BUFFER_SIZES: [256, 512, 1024, 2048]
} as const;

export const LOG_LEVELS = ['debug', 'info', 'warn', 'error'] as const;
