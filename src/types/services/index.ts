// src/types/services/index.ts
//
// Consolidated service type definitions that define the core service interfaces
// and type system for all services in the application

import { BaseConfig, BaseStatus, AIConfig, HomeConfig, MusicConfig } from '../core';
import { HardwareConfig } from '../hardware';
import { AudioBuffer } from '../hardware/audio';

// Base Service interface
export interface Service {
    initialize(): Promise<void>;
    shutdown(): Promise<void>;
    getStatus(): ServiceStatus;
    isHealthy(): boolean;
}

export interface ServiceStatus extends BaseStatus {
    state: ServiceState;
    isHealthy: boolean;
    lastError?: ServiceError;
    lastUpdate?: Date;
}

export type ServiceState = 'initializing' | 'ready' | 'error' | 'shutdown' | 'maintenance';

export interface ServiceError extends Error {
    name: 'ServiceError';
    serviceName: string;
    severity: 'low' | 'medium' | 'high';
    timestamp: Date;
}

// Service-specific interfaces
export interface IrohAIService extends Service {
    processText(text: string): Promise<string>;
    generateSpeech(text: string): Promise<AudioBuffer>;
    processTextStreaming(text: string): Promise<void>;
    config: AIConfig;
}

export interface HAService extends Service {
    controlDevice(deviceId: string, command: string): Promise<void>;
    getEntityStatus(entityId: string): Promise<HAEntityStatus>;
    onEntityState(entityId: string, handler: HAStateHandler): void;
    config: HomeConfig;
}

export interface HAEntityStatus {
    entityId: string;
    state: any;
    attributes: Record<string, any>;
    lastChanged: Date;
}

export type HAStateHandler = (entityId: string, state: HAEntityStatus) => Promise<void>;

export interface HAEvent {
    type: 'state_changed' | 'service_call';
    entityId: string;
    state: HAEntityStatus;
    timestamp: Date;
}

export interface MusicService extends Service {
    play(track: string): Promise<void>;
    pause(): Promise<void>;
    stop(): Promise<void>;
    isPlaying(): boolean;
    config: MusicConfig;
}

export interface TimerService extends Service {
    createTimer(duration: number): Promise<string>;
    cancelTimer(timerId: string): Promise<void>;
    getActiveTimers(): string[];
    config: TimerConfig;
}

export interface HardwareService extends Service {
    playAudio(audio: AudioBuffer): Promise<void>;
    startRecording(): Promise<void>;
    stopRecording(): Promise<void>;
    isRecording(): boolean;
    config: HardwareConfig;
}

// Service registry and config types
export interface ServiceRegistry {
    ai: IrohAIService;
    home: HAService;
    music: MusicService;
    timer: TimerService;
    hardware: HardwareService;
}

export type ServiceName = keyof ServiceRegistry;

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
    ai: AIConfig;
    home: HomeConfig;
    music: MusicConfig;
}

// Additional type exports
export * from './ai';
export * from './home';
export * from './music';