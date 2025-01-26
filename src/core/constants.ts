// src/core/constants.ts
//
// System-wide constants including:
// - Event types for system, hardware, and service events
// - Error codes for various failure scenarios
// - Configuration defaults
// - DAHDI-specific constants and codes

export const SYSTEM = {
    VERSION: '1.0.0',
    NAME: 'Iroh',
    DEFAULT_PORT: 3000
};

// Event types for all system components
export const EVENTS = {
    // Phone/Hardware events including DAHDI
    PHONE: {
        OFF_HOOK: 'phone:offHook',
        ON_HOOK: 'phone:onHook',
        DTMF: 'phone:dtmf',
        VOICE: 'phone:voice',
        // DAHDI-specific events
        RING_START: 'phone:ringStart',
        RING_STOP: 'phone:ringStop',
        LINE_VOLTAGE: 'phone:lineVoltage',
        AUDIO_OVERRUN: 'phone:audioOverrun',
        AUDIO_UNDERRUN: 'phone:audioUnderrun',
        ECHO_CANCEL: 'phone:echoCancel'
    },

    // Core system events
    SYSTEM: {
        READY: 'system:ready',
        ERROR: 'system:error',
        SHUTDOWN: 'system:shutdown',
        // DAHDI system events
        HARDWARE_DETECTED: 'system:hardwareDetected',
        DRIVER_LOADED: 'system:driverLoaded',
        CHANNEL_MAPPED: 'system:channelMapped'
    },

    // Home automation events
    HOME: {
        DEVICE_CHANGE: 'home:deviceChange',
        SCENE_ACTIVATED: 'home:sceneActivated'
    },

    // Music service events
    MUSIC: {
        PLAY: 'music:play',
        PAUSE: 'music:pause',
        NEXT: 'music:next',
        PREVIOUS: 'music:previous'
    },

    // DAHDI hardware events
    DAHDI: {
        ALARM: 'dahdi:alarm',
        NO_SIGNAL: 'dahdi:noSignal',
        SIGNAL_RESTORED: 'dahdi:signalRestored',
        SYNC_LOST: 'dahdi:syncLost',
        SYNC_RESTORED: 'dahdi:syncRestored',
        BUFFER_ERROR: 'dahdi:bufferError',
        DEVICE_ERROR: 'dahdi:deviceError'
    }
};

export const DAHDI_CONSTANTS = {
    // Device paths
    DEVICE_PATH: '/dev/dahdi/channel001',
    CONTROL_PATH: '/dev/dahdi/ctl',
    
    // Audio format requirements (immutable for DAHDI)
    SAMPLE_RATE: 8000,
    CHANNELS: 1,
    BIT_DEPTH: 16,
    
    // Hardware settings
    LINE_IMPEDANCE: 600,
    FXS_VOLTAGE: 48,
    RING_VOLTAGE: 90,
    
    // Buffer configuration
    BUFFER_SIZE: 320,  // 20ms at 8kHz/16-bit
    MIN_BUFFER_SIZE: 32,
    MAX_BUFFER_SIZE: 8192,
    
    // Default channel settings
    DEFAULT_CHANNEL: 1,
    MAX_CHANNELS: 32,
    
    // Timing constants
    RING_TIMEOUT: 2000,
    DTMF_TIMEOUT: 40,
    ECHO_CANCEL_TAPS: 128
} as const;


// Error codes for system components
export const ERROR_CODES = {
    // Hardware errors including DAHDI
    HARDWARE: {
        PHONE_DISCONNECTED: 'HARDWARE_001',
        FXS_ERROR: 'HARDWARE_002',
        AUDIO_ERROR: 'HARDWARE_003',
        // DAHDI-specific error codes
        DAHDI_NOT_LOADED: 'HARDWARE_004',
        DAHDI_DEVICE_NOT_FOUND: 'HARDWARE_005',
        DAHDI_CHANNEL_ERROR: 'HARDWARE_006',
        DAHDI_CONFIG_ERROR: 'HARDWARE_007',
        DAHDI_SYNC_ERROR: 'HARDWARE_008',
        DAHDI_TIMING_ERROR: 'HARDWARE_009',
        DAHDI_ALARM_ERROR: 'HARDWARE_010',
        DAHDI_BUFFER_ERROR: 'HARDWARE_011',
        DAHDI_PERMISSION_ERROR: 'HARDWARE_012'
    },

    // Core system errors
    SYSTEM: {
        INITIALIZATION_FAILED: 'SYSTEM_001',
        INVALID_CONFIG: 'SYSTEM_002',
        STATE_ERROR: 'SYSTEM_003',
        // DAHDI system errors
        DRIVER_LOAD_FAILED: 'SYSTEM_004',
        DEVICE_MAPPING_FAILED: 'SYSTEM_005',
        KERNEL_MODULE_ERROR: 'SYSTEM_006'
    },

    // Service-level errors
    SERVICE: {
        AI_ERROR: 'SERVICE_001',
        HOMEKIT_ERROR: 'SERVICE_002',
        MUSIC_ERROR: 'SERVICE_003'
    }
};

// System timeouts
export const TIMEOUTS = {
    COMMAND: 5000,     // 5 seconds for command completion
    RESPONSE: 10000,   // 10 seconds for response
    SHUTDOWN: 3000,    // 3 seconds for shutdown
    // DAHDI-specific timeouts
    RING: 2000,        // 2 seconds default ring duration
    DTMF: 40,         // 40ms minimum DTMF duration
    ECHO_CANCEL: 128,  // Echo cancellation taps
    BUFFER: 20         // 20ms audio buffer size
};

// System defaults
export const DEFAULTS = {
    // DAHDI audio configuration
    AUDIO: {
        SAMPLE_RATE: 8000,   // DAHDI requires 8kHz
        CHANNELS: 1,         // DAHDI uses mono audio
        BIT_DEPTH: 16,       // DAHDI uses 16-bit PCM
        BUFFER_SIZE: 160,    // 160 bytes = 20ms at 8kHz
        BLOCKS: 8,           // Number of buffer blocks
        RING_FREQUENCY: 20   // 20Hz ring frequency
    },

    // AI service configuration
    AI: {
        MAX_TOKENS: 1024,
        TEMPERATURE: 0.7,
        VOICE_ID: 'uncle-iroh'
    },

    // Home automation configuration
    HOME: {
        BRIDGE_NAME: 'Iroh Bridge',
        BRIDGE_PORT: 47128,
        PIN: '031-45-154'
    },

    // DAHDI hardware configuration
    DAHDI: {
        DEVICE_PATH: '/dev/dahdi/channel',
        CONTROL_PATH: '/dev/dahdi/ctl',
        LOADZONE: 'us',          // Default tone zone
        DEFAULT_ZONE: 'us',      // Default region
        LINE_IMPEDANCE: 600,     // 600Ω line impedance
        FXS_VOLTAGE: 48,         // 48V FXS line voltage
        RING_VOLTAGE: 90,        // 90V ring voltage
        MAX_CHANNELS: 32,        // Maximum channels per span
        MIN_BUFFER_SIZE: 32,     // Minimum buffer size (samples)
        MAX_BUFFER_SIZE: 8192    // Maximum buffer size (samples)
    }
};

// DAHDI IOCTLs and commands
export const DAHDI_COMMANDS = {
    GET_PARAMS: 0x40045700,     // Get channel parameters
    SET_PARAMS: 0x40045701,     // Set channel parameters
    DIAL: 0x40045702,           // Send dial command
    RING_ON: 0x40045703,        // Start ringing
    RING_OFF: 0x40045704,       // Stop ringing
    GET_BUFINFO: 0x40045705,    // Get buffer information
    SET_BUFINFO: 0x40045706,    // Set buffer configuration
    CONF_START: 0x40045707,     // Start conferencing
    CONF_STOP: 0x40045708,      // Stop conferencing
    EC_ON: 0x40045709,          // Enable echo cancellation
    EC_OFF: 0x4004570a,         // Disable echo cancellation
    GET_GAINS: 0x4004570b,      // Get audio gains
    SET_GAINS: 0x4004570c       // Set audio gains
};

// DAHDI alarm states
export const DAHDI_ALARMS = {
    NONE: 0x00,                 // No alarms
    RED: 0x01,                  // Red alarm - no signal
    YELLOW: 0x02,              // Yellow alarm - remote error
    BLUE: 0x04,                // Blue alarm - unframed signal
    NOTOPEN: 0x08,             // Device not opened
    RESET: 0x10,               // Span needs reset
    LOOPBACK: 0x20,            // Loopback in progress
    RECOVERING: 0x40           // Recovering from alarm
};