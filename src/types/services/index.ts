// src/types/services/index.ts

import { BaseConfig, BaseStatus, AIConfig, HomeConfig, MusicConfig } from '../core';
import { HardwareConfig } from '../hardware';
import { AudioBuffer } from '../hardware/audio';
import { ServiceError } from '../errors';

// Service interfaces
export interface Service {
    initialize(): Promise<void>;
    shutdown(): Promise<void>;
    getStatus(): ServiceStatus;
    isHealthy(): boolean;
}

export interface ServiceStatus {
    state: ServiceState;
    isHealthy: boolean;
    lastError?: Error;
    lastUpdate?: Date;
}

export type ServiceState = 'initializing' | 'ready' | 'error' | 'shutdown' | 'maintenance';

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

// Service-specific interfaces
export interface IrohAIService extends Service {
    processText(text: string): Promise<string>;
    generateSpeech(text: string): Promise<AudioBuffer>;
    isHealthy(): boolean;
    config: AIConfig;
}

export interface HAService extends Service {
    controlDevice(deviceId: string, command: string): Promise<void>;
    getEntityStatus(entityId: string): Promise<any>;
    isHealthy(): boolean;
    config: HomeConfig;
}

export interface MusicService extends Service {
    play(track: string): Promise<void>;
    pause(): Promise<void>;
    stop(): Promise<void>;
    isPlaying(): boolean;
    isHealthy(): boolean;
    config: MusicConfig;
}

export interface TimerService extends Service {
    createTimer(duration: number): Promise<string>;
    cancelTimer(timerId: string): Promise<void>;
    getActiveTimers(): string[];
    isHealthy(): boolean;
}

export interface HardwareService extends Service {
    playAudio(audio: AudioBuffer): Promise<void>;
    startRecording(): Promise<void>;
    stopRecording(): Promise<void>;
    isRecording(): boolean;
    isHealthy(): boolean;
    config: HardwareConfig;
}

// Service registry type
export interface ServiceRegistry {
    ai: IrohAIService;
    home: HAService;
    music: MusicService;
    timer: TimerService;
    hardware: HardwareService;
}

export type ServiceName = keyof ServiceRegistry;

// Re-export service-specific configs
export * from './ai';
export * from './home';
export * from './music';
