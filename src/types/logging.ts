// src/types/logging.ts
//
// Defines the core logging types used throughout the application
// Provides type-safe logging with comprehensive metadata support

/** Available log levels */
export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

/** Base interface for log metadata */
export interface BaseLogMetadata {
    /** Module or component generating the log */
    component?: string;
    /** Operation being performed */
    operation?: string;
    /** Timestamp of the log entry */
    timestamp?: string;
    /** Additional contextual data */
    context?: Record<string, unknown>;
}

/** Error-specific metadata */
export interface ErrorLogMetadata extends BaseLogMetadata {
    /** Error information */
    error?: {
        message: string;
        name: string;
        stack?: string;
        code?: string;
    };
}

/** Hardware-specific metadata */
export interface HardwareLogMetadata extends BaseLogMetadata {
    deviceId?: string;
    channelNumber?: number;
    voltage?: number;
    signal?: number;
    bufferSize?: number;
    sampleRate?: number;
}

/** Audio-specific metadata */
export interface AudioLogMetadata extends BaseLogMetadata {
    duration?: number;
    format?: {
        sampleRate: number;
        channels: number;
        bitDepth: number;
    };
    bufferSize?: number;
    level?: number;
}

/** Service-specific metadata */
export interface ServiceLogMetadata extends BaseLogMetadata {
    serviceId?: string;
    status?: string;
    metrics?: Record<string, number>;
    config?: Record<string, unknown>;
}

/** Command-specific metadata */
export interface CommandLogMetadata extends BaseLogMetadata {
    commandId?: string;
    command?: string;
    parameters?: Record<string, unknown>;
    duration?: number;
}

/** State change metadata */
export interface StateLogMetadata extends BaseLogMetadata {
    previousState?: string;
    newState?: string;
    stateData?: Record<string, unknown>;
}

/** Combined log metadata type */
export type LogMetadata = 
    | BaseLogMetadata 
    | ErrorLogMetadata 
    | HardwareLogMetadata 
    | AudioLogMetadata 
    | ServiceLogMetadata 
    | CommandLogMetadata 
    | StateLogMetadata;

/** Configuration for the logging system */
export interface LoggerConfig {
    /** Minimum log level to record */
    level: LogLevel;
    /** Directory to store log files */
    directory: string;
    /** Maximum number of files to keep */
    maxFiles: string;
    /** Maximum size per log file */
    maxSize: string;
    /** Whether to log to console */
    console?: boolean;
    /** Whether to include timestamps */
    timestamps?: boolean;
    /** Additional formatting options */
    format?: {
        colors?: boolean;
        json?: boolean;
        prettyPrint?: boolean;
    };
}

/** Interface for log entries */
export interface LogEntry {
    /** Log level */
    level: LogLevel;
    /** Log message */
    message: string;
    /** Timestamp of the log entry */
    timestamp: string;
    /** Associated metadata */
    metadata?: LogMetadata;
}

/** Type guard to check if metadata contains error information */
export function isErrorMetadata(metadata: LogMetadata): metadata is ErrorLogMetadata {
    return 'error' in metadata;
}

/** Type guard to check if metadata is hardware related */
export function isHardwareMetadata(metadata: LogMetadata): metadata is HardwareLogMetadata {
    return 'deviceId' in metadata || 'channelNumber' in metadata;
}

/** Type guard to check if metadata is audio related */
export function isAudioMetadata(metadata: LogMetadata): metadata is AudioLogMetadata {
    return 'format' in metadata || 'bufferSize' in metadata;
}

/** Type guard to check if metadata is service related */
export function isServiceMetadata(metadata: LogMetadata): metadata is ServiceLogMetadata {
    return 'serviceId' in metadata || 'metrics' in metadata;
}

/** Type guard to check if metadata is command related */
export function isCommandMetadata(metadata: LogMetadata): metadata is CommandLogMetadata {
    return 'commandId' in metadata || 'command' in metadata;
}

/** Type guard to check if metadata is state related */
export function isStateMetadata(metadata: LogMetadata): metadata is StateLogMetadata {
    return 'previousState' in metadata || 'newState' in metadata;
}
