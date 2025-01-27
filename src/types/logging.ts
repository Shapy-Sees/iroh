// Define log levels
export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

// Define error severity levels
export enum ErrorSeverity {
    LOW = 'low',
    MEDIUM = 'medium',
    HIGH = 'high',
    CRITICAL = 'critical'
}

// Component types for metadata
export type LogComponent = 'hardware' | 'audio' | 'service' | 'system' | 'ai' | 'state';

// Base metadata interface with required fields
export interface BaseLogMetadata {
    component: LogComponent;
    timestamp: string;
    type: LogMetadataType;
    context?: Record<string, unknown>;
    operation?: string;
    severity?: ErrorSeverity;
}

export type LogMetadataType = 'error' | 'hardware' | 'audio' | 'service' | 'command' | 'state';

// Specific metadata interfaces extending base
export interface ErrorLogMetadata extends BaseLogMetadata {
    type: 'error';
    error: {
        message: string;
        name: string;
        code?: string;
        stack?: string;
    };
    severity: ErrorSeverity;
}

export interface HardwareLogMetadata extends BaseLogMetadata {
    type: 'hardware';
    deviceId: string;
    channelNumber?: number;
    status?: string;
    metrics?: {
        voltage?: number;
        signal?: number;
        bufferSize?: number;
        sampleRate?: number;
    };
}

export interface AudioLogMetadata extends BaseLogMetadata {
    type: 'audio';
    format: {
        sampleRate: number;
        channels: number;
        bitDepth: number;
    };
    duration?: number;
    level?: number;
}

export interface ServiceLogMetadata extends BaseLogMetadata {
    type: 'service';
    serviceId: string;
    status: string;
    metrics?: Record<string, number>;
}

export interface CommandLogMetadata extends BaseLogMetadata {
    type: 'command';
    commandId: string;
    command: string;
    duration?: number;
    parameters?: Record<string, unknown>;
}

export interface StateLogMetadata extends BaseLogMetadata {
    type: 'state';
    previousState: string;
    newState: string;
    stateData?: Record<string, unknown>;
}

// Combined type for all possible metadata
export type LogMetadata =
    | ErrorLogMetadata
    | HardwareLogMetadata
    | AudioLogMetadata
    | ServiceLogMetadata
    | CommandLogMetadata
    | StateLogMetadata;

// Configuration interface
export interface LoggerConfig {
    level: LogLevel;
    directory: string;
    maxFiles: string;
    maxSize: string;
    console?: boolean;
    timestamps?: boolean;
    format?: {
        colors?: boolean;
        json?: boolean;
        prettyPrint?: boolean;
    };
}

// Log entry interface
export interface LogEntry {
    level: LogLevel;
    message: string;
    timestamp: string;
    metadata: LogMetadata;
}

// Type guards with discriminated unions
export const isErrorMetadata = (metadata: LogMetadata): metadata is ErrorLogMetadata =>
    metadata.type === 'error' && 'error' in metadata;

export const isHardwareMetadata = (metadata: LogMetadata): metadata is HardwareLogMetadata =>
    metadata.type === 'hardware' && 'deviceId' in metadata;

export const isAudioMetadata = (metadata: LogMetadata): metadata is AudioLogMetadata =>
    metadata.type === 'audio' && 'format' in metadata;

export const isServiceMetadata = (metadata: LogMetadata): metadata is ServiceLogMetadata =>
    metadata.type === 'service' && 'serviceId' in metadata;

export const isCommandMetadata = (metadata: LogMetadata): metadata is CommandLogMetadata =>
    metadata.type === 'command' && 'commandId' in metadata;

export const isStateMetadata = (metadata: LogMetadata): metadata is StateLogMetadata =>
    metadata.type === 'state' && 'previousState' in metadata && 'newState' in metadata;

// Validation helpers
export const validateMetadata = (metadata: LogMetadata): boolean => {
    if (!metadata.type || !metadata.component) return false;

    const isValidComponent = (component: string): component is LogComponent => {
        return ['hardware', 'audio', 'service', 'system', 'ai', 'state'].includes(component);
    };

    if (!isValidComponent(metadata.component)) return false;

    switch (metadata.type) {
        case 'error':
            return isErrorMetadata(metadata);
        case 'hardware':
            return isHardwareMetadata(metadata);
        case 'audio':
            return isAudioMetadata(metadata);
        case 'service':
            return isServiceMetadata(metadata);
        case 'command':
            return isCommandMetadata(metadata);
        case 'state':
            return isStateMetadata(metadata);
        default:
            return false;
    }
};

// New helper for creating metadata
export function createLogMetadata<T extends LogMetadataType>(
    type: T,
    component: LogComponent,
    data: Partial<Extract<LogMetadata, { type: T }>>
): Extract<LogMetadata, { type: T }> {
    return {
        type,
        component,
        timestamp: new Date().toISOString(),
        ...data
    } as Extract<LogMetadata, { type: T }>;
}
