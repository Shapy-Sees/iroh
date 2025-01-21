// src/core/constants.ts
//
// Key Features:
// - System-wide constants
// - Configuration defaults
// - Error codes
// - Event names

export const SYSTEM = {
    VERSION: '1.0.0',
    NAME: 'Iroh',
    DEFAULT_PORT: 3000
};

export const EVENTS = {
    PHONE: {
        OFF_HOOK: 'phone:offHook',
        ON_HOOK: 'phone:onHook',
        DTMF: 'phone:dtmf',
        VOICE: 'phone:voice'
    },
    SYSTEM: {
        READY: 'system:ready',
        ERROR: 'system:error',
        SHUTDOWN: 'system:shutdown'
    },
    HOME: {
        DEVICE_CHANGE: 'home:deviceChange',
        SCENE_ACTIVATED: 'home:sceneActivated'
    },
    MUSIC: {
        PLAY: 'music:play',
        PAUSE: 'music:pause',
        NEXT: 'music:next',
        PREVIOUS: 'music:previous'
    }
};

export const ERROR_CODES = {
    HARDWARE: {
        PHONE_DISCONNECTED: 'HARDWARE_001',
        FXS_ERROR: 'HARDWARE_002',
        AUDIO_ERROR: 'HARDWARE_003'
    },
    SYSTEM: {
        INITIALIZATION_FAILED: 'SYSTEM_001',
        INVALID_CONFIG: 'SYSTEM_002',
        STATE_ERROR: 'SYSTEM_003'
    },
    SERVICE: {
        AI_ERROR: 'SERVICE_001',
        HOMEKIT_ERROR: 'SERVICE_002',
        MUSIC_ERROR: 'SERVICE_003'
    }
};

export const TIMEOUTS = {
    COMMAND: 5000,    // 5 seconds
    RESPONSE: 10000,  // 10 seconds
    SHUTDOWN: 3000    // 3 seconds
};

export const DEFAULTS = {
    AUDIO: {
        SAMPLE_RATE: 8000,
        CHANNELS: 1,
        BIT_DEPTH: 16
    },
    AI: {
        MAX_TOKENS: 1024,
        TEMPERATURE: 0.7,
        VOICE_ID: 'uncle-iroh'
    },
    HOME: {
        BRIDGE_NAME: 'Iroh Bridge',
        BRIDGE_PORT: 47128,
        PIN: '031-45-154'
    }
};