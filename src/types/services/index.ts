// src/types/services/index.ts
//
// Service type definitions that define the core service interfaces
// and type system for all services in the application

import { ServiceStatus, AudioConfig, AIConfig, HomeConfig, MusicConfig } from '../core';
import { HardwareConfig } from '../hardware';
import { AudioBuffer } from '../hardware/audio';

// Base Service interface that all services must implement
export interface Service {
    initialize(): Promise<void>;
    shutdown(): Promise<void>;
    getStatus(): ServiceStatus;
    isHealthy(): boolean;
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
    getEntityState(entityId: string): Promise<HAEntityStatus>;
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
}

export interface HardwareService extends Service {
    playAudio(audio: AudioBuffer): Promise<void>;
    startRecording(): Promise<void>;
    stopRecording(): Promise<void>;
    isRecording(): boolean;
    config: HardwareConfig;
}

// Service error types
export interface ServiceError extends Error {
    name: 'ServiceError';
    serviceName: string;
    severity: 'low' | 'medium' | 'high';
    timestamp: Date;
}

// Service events
export interface ServiceEvent {
    type: 'state_changed' | 'error' | 'ready';
    service: string;
    timestamp: Date;
    data?: any;
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