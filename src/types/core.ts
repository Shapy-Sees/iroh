// src/types/core.ts

// Core type definitions for Project Iroh
// Contains all shared interfaces, types, and enums used across the application

import { Buffer } from 'buffer';

// ===== Core Result Types =====

/**
 * Generic result type for operations that can fail
 */
export interface Result<T> {
    success: boolean;
    data?: T;
    error?: Error;
}

// ===== Error Types =====

/**
 * Error severity levels for the application
 */
export enum ErrorSeverity {
    LOW = 'low',
    MEDIUM = 'medium',
    HIGH = 'high',
    CRITICAL = 'critical'
}

/**
 * Base error class for Iroh-specific errors
 */
export class IrohError extends Error {
    constructor(
        message: string,
        public readonly code?: string,
        public readonly timestamp: number = Date.now()
    ) {
        super(message);
        this.name = 'IrohError';
    }
}

// ===== Hardware Types =====

/**
 * Configuration for FXS (Foreign Exchange Station) hardware
 */
export interface FXSConfig {
    devicePath: string;
    sampleRate: number;
    impedance: number;
    channel: number;
}

/**
 * Audio format specification
 */
export interface AudioFormat {
    sampleRate: number;
    channels: number;
    bitDepth: number;
    format?: 'linear' | 'alaw' | 'ulaw';
}

/**
 * Audio input data structure
 */
export interface AudioInput {
    data: Buffer;
    sampleRate: number;
    channels: number;
    bitDepth: number;
    timestamp?: number;
}

// ===== Controller Types =====

/**
 * Phone controller states
 */
export enum PhoneState {
    IDLE = 'idle',
    OFF_HOOK = 'off_hook',
    RINGING = 'ringing',
    IN_CALL = 'in_call',
    ERROR = 'error'
}

/**
 * DTMF event data
 */
export interface DTMFEvent {
    digit: string;
    duration: number;
    timestamp: number;
    power?: number;
}

/**
 * Voice event data
 */
export interface VoiceEvent {
    startTime: number;
    endTime: number;
    isFinal: boolean;
    audio?: Buffer;
    confidence?: number;
}

// ===== Service Types =====

/**
 * AI service configuration
 */
export interface AIConfig {
    anthropicKey: string;
    elevenLabsKey: string;
    openAIKey: string;
    maxTokens: number;
    temperature: number;
    voiceId: string;
}

/**
 * Music service configuration
 */
export interface MusicConfig {
    spotifyClientId?: string;
    spotifyClientSecret?: string;
}

/**
 * Home automation configuration
 */
export interface HomeConfig {
    homekitBridge: {
        pin: string;
        name: string;
        port: number;
    };
}

/**
 * Logging configuration
 */
export interface LogConfig {
    level: 'error' | 'warn' | 'info' | 'debug';
    path: string;
    maxSize: string;
    maxFiles: number;
}

/**
 * Application configuration
 */
export interface AppConfig {
    name: string;
    version: string;
    environment: 'development' | 'production' | 'test';
}

/**
 * Complete configuration type
 */
export interface Config {
    app: AppConfig;
    audio: {
        bufferSize: number;
        vadThreshold: number;
    };
    ai: AIConfig;
    music: MusicConfig;
    home: HomeConfig;
    logging: LogConfig;
}

// ===== Event Types =====

/**
 * Base event interface
 */
export interface BaseEvent {
    type: string;
    timestamp: number;
}

/**
 * Hardware event interface
 */
export interface HardwareEvent extends BaseEvent {
    type: 'hardware';
    status: 'online' | 'offline' | 'error';
    details?: Record<string, unknown>;
}

/**
 * Service event interface
 */
export interface ServiceEvent extends BaseEvent {
    type: 'service';
    service: string;
    status: 'started' | 'stopped' | 'error';
    details?: Record<string, unknown>;
}

/**
 * Diagnostic result interface
 */
export interface DiagnosticResult {
    test: string;
    passed: boolean;
    message?: string;
    details?: Record<string, unknown>;
}

// ===== Command Types =====

/**
 * Command status type
 */
export type CommandStatus = 'pending' | 'running' | 'completed' | 'failed';

/**
 * Base command interface
 */
export interface Command {
    type: string;
    id: string;
    status: CommandStatus;
    timestamp: number;
    metadata?: Record<string, unknown>;
}

/**
 * Command result interface
 */
export interface CommandResult<T> {
    command: Command;
    result?: T;
    error?: Error;
    duration: number;
}
