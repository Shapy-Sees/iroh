// src/types/services/index.ts

import { BaseConfig, BaseStatus } from '../core';
import { HardwareConfig } from '../hardware';

// Service interfaces
export interface Service {
    initialize(): Promise<void>;
    shutdown(): Promise<void>;
    getStatus(): ServiceStatus;
}

export interface ServiceStatus extends BaseStatus {
    state: ServiceState;
    lastUpdate?: Date;
}

export type ServiceState = 'initializing' | 'ready' | 'error' | 'shutdown';

export interface ServiceConfig extends BaseConfig {
    app: {
        name: string;
        env: string;
        port: number;
    };
    hardware: HardwareConfig;
    logging: {
        level: string;
        directory: string;
        maxFiles: string;
        maxSize: string;
    };
}

export interface ServiceError extends Error {
    serviceName: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    timestamp: Date;
}

// Service registry type
export type ServiceRegistry = {
    ai: IrohAIService;
    home: HAService;
    music: MusicService;
    timer: TimerService;
    hardware: HardwareService;
};

export type ServiceName = keyof ServiceRegistry;

// Re-export service-specific configs
export * from './ai';
export * from './home';
export * from './music';
