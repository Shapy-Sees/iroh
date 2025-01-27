// src/types/logging.ts
//
// Type definitions for logging system
// Provides strongly typed logging interfaces, metadata types, and validation helpers

// Define log levels
export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

// Define error severity levels
export enum ErrorSeverity {
    LOW = 'low',
    MEDIUM = 'medium',
    HIGH = 'high',
    CRITICAL = 'critical'
}

// Define components that can log
export type LogComponent = 
    | 'hardware' 
    | 'audio' 
    | 'service' 
    | 'system' 
    | 'ai' 
    | 'state'
    | 'phone'
    | 'timer'
    | 'music'
    | 'config'
    | 'intent';

// Log metadata types
export type LogMetadataType = 
    | 'error' 
    | 'hardware' 
    | 'audio' 
    | 'service' 
    | 'command' 
    | 'state'
    | 'config'
    | 'event'
    | 'debug';

// Base metadata interface with required fields
export interface BaseLogMetadata {
    component: LogComponent;
    type: LogMetadataType;
    timestamp: string;
    details?: Record<string, unknown>;
    severity?: ErrorSeverity;
}

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
    bytes?: number;
    droppedFrames?: number;
    processedFrames?: number;
}

export interface ServiceLogMetadata extends BaseLogMetadata {
    type: 'service';
    serviceId: string;
    status: string;
    metrics?: Record<string, number>;
    action?: string;
    operation?: string;
    result?: string;
}

export interface CommandLogMetadata extends BaseLogMetadata {
    type: 'command';
    commandId: string;
    command: string;
    duration?: number;
    parameters?: Record<string, unknown>;
    success?: boolean;
}

export interface StateLogMetadata extends BaseLogMetadata {
    type: 'state';
    previousState: string;
    newState: string;
    stateData?: Record<string, unknown>;
    entityId?: string;
}

export interface ConfigLogMetadata extends BaseLogMetadata {
    type: 'config';
    configType: string;
    changes?: Record<string, unknown>;
    validation?: {
        isValid: boolean;
        errors?: string[];
    };
}

export interface EventLogMetadata extends BaseLogMetadata {
    type: 'event';
    eventType: string;
    eventId: string;
    data?: Record<string, unknown>;
}

export interface DebugLogMetadata extends BaseLogMetadata {
    type: 'debug';
    debugType: string;
    data?: Record<string, unknown>;
}

// Combined type for all possible metadata
export type LogMetadata =
    | ErrorLogMetadata
    | HardwareLogMetadata
    | AudioLogMetadata
    | ServiceLogMetadata
    | CommandLogMetadata
    | StateLogMetadata
    | ConfigLogMetadata
    | EventLogMetadata
    | DebugLogMetadata;

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
    metadata.type === 'error';

export const isHardwareMetadata = (metadata: LogMetadata): metadata is HardwareLogMetadata =>
    metadata.type === 'hardware';

export const isAudioMetadata = (metadata: LogMetadata): metadata is AudioLogMetadata =>
    metadata.type === 'audio';

export const isServiceMetadata = (metadata: LogMetadata): metadata is ServiceLogMetadata =>
    metadata.type === 'service';

export const isCommandMetadata = (metadata: LogMetadata): metadata is CommandLogMetadata =>
    metadata.type === 'command';

export const isStateMetadata = (metadata: LogMetadata): metadata is StateLogMetadata =>
    metadata.type === 'state';

export const isConfigMetadata = (metadata: LogMetadata): metadata is ConfigLogMetadata =>
    metadata.type === 'config';

export const isEventMetadata = (metadata: LogMetadata): metadata is EventLogMetadata =>
    metadata.type === 'event';

export const isDebugMetadata = (metadata: LogMetadata): metadata is DebugLogMetadata =>
    metadata.type === 'debug';

// Validation helpers
export const validateMetadata = (metadata: LogMetadata): boolean => {
    if (!metadata.type || !metadata.component) return false;

    const isValidComponent = (component: string): component is LogComponent => {
        return ['hardware', 'audio', 'service', 'system', 'ai', 'state', 'phone', 'timer', 'music', 'config', 'intent'].includes(component);
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
        case 'config':
            return isConfigMetadata(metadata);
        case 'event':
            return isEventMetadata(metadata);
        case 'debug':
            return isDebugMetadata(metadata);
        default:
            return false;
    }
};

// Helper function to create typed metadata
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