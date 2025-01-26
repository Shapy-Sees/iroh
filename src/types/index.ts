// src/types/index.ts
//
// Consolidated type definitions for the entire Iroh project.
// This is the single source of truth for all type definitions,
// providing consistent typing across all components.

import { Buffer } from 'buffer';

// Core config types
export interface Config {
    app: AppConfig;
    audio: AudioConfig;
    logging: LogConfig;
    services: ServiceConfig;
}

export interface AppConfig {
    name: string;
    env: 'development' | 'production' | 'test';
    port: number;
    dataDir?: string;
}

export interface LogConfig {
    level: 'debug' | 'info' | 'warn' | 'error';
    directory: string;
    maxFiles: string;
    maxSize: string;
    console?: boolean;
}

// Event system types
export interface EventBusConfig {
    maxHistory?: number;
    debug?: boolean;
    persistence?: {
        enabled: boolean;
        path?: string;
    };
}

export interface EventHistoryItem<T = any> {
    event: string;
    data: T;
    timestamp: number;
    id: string;
    metadata?: Record<string, any>;
}

// Status tracking
export interface ServiceStatus {
    isInitialized: boolean;
    isHealthy: boolean;
    lastError?: Error;
    metrics: {
        uptime: number;
        errors: number;
        warnings: number;
        lastChecked?: Date;
    };
}

// Re-export all types
export * from './hardware/dahdi';
export * from './hardware/fxs';
export * from './hardware/audio';
export * from './services';
export * from './errors';