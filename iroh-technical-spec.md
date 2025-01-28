# Iroh Technical Specification

## Project Overview

Iroh is an AI-powered interface for vintage telephones that provides smart home control, voice interaction, and media playback capabilities. The system integrates with DAHDI hardware to bridge analog telephony with modern digital services.

## System Architecture & Component Organization

### Core Layer
- **Purpose**: Provides fundamental system services and coordination
- **Key Components**: EventBus, StateManager, Configuration
- **Requirements**:
  - Must initialize before other layers
  - Handles cross-cutting concerns
  - Provides type-safe interfaces
  - Manages system-wide state

### Hardware Layer
- **Purpose**: Manages DAHDI/FXS hardware interaction
- **Key Components**: DAHDIInterface, AudioPipeline, HardwareService
- **Requirements**:
  - Must maintain DAHDI compatibility (8kHz/16-bit/mono)
  - Implements hardware abstraction
  - Provides error recovery
  - Handles real-time audio processing
  - Must implement Service interface

### Service Layer
- **Purpose**: Implements business logic and external integrations
- **Key Requirements**:
  - All services must implement the Service interface
  - Must maintain service status
  - Must implement proper error handling
  - Must emit typed events
  - Services must be independently testable
  - Must provide clean shutdown

## Type System

Rule: No new type files can be added.

### Base Configuration Types
```typescript
// Base configuration interface
export interface BaseConfig {
    enabled?: boolean;
    retryAttempts?: number;
    timeout?: number;
}

// Service configuration
export interface ServiceConfig extends BaseConfig {
    ai: AIConfig;
    home: HomeConfig;
    music: MusicConfig;
    timer: TimerConfig;
    hardware: HardwareConfig;
}

// Application configuration
export interface Config {
    app: AppConfig;
    hardware: {
        audio: AudioConfig;
        dahdi: DAHDIConfig;
    };
    services: ServiceConfig;
    logging: LogConfig;
}
```

### Service Types
```typescript
// Base service interface
export interface Service {
    initialize(): Promise<void>;
    shutdown(): Promise<void>;
    getStatus(): ServiceStatus;
    isHealthy(): boolean;
    emit<K extends keyof ServiceEventMap>(event: K, payload: ServiceEventMap[K]): boolean;
    on<K extends keyof ServiceEventMap>(event: K, handler: (payload: ServiceEventMap[K]) => void): void;
}

// Service event map
export interface ServiceEventMap {
    'service:initialized': { serviceName: ServiceName };
    'service:error': { serviceName: ServiceName; error: ServiceError };
    'service:stateChanged': { serviceName: ServiceName; status: ServiceStatus };
    'service:shutdown': { serviceName: ServiceName };
}

// Service status
export interface ServiceStatus {
    state: ServiceState;
    isHealthy: boolean;
    lastError?: Error;
    lastUpdate: Date;
    metrics?: {
        uptime: number;
        errors: number;
        warnings: number;
        lastChecked: Date;
    };
}

export type ServiceState = 'initializing' | 'ready' | 'error' | 'shutdown' | 'maintenance';
```

### Audio Types
```typescript
// DAHDI-compatible audio format
export interface AudioFormat {
    sampleRate: 8000;  // DAHDI requires 8kHz
    channels: 1;       // DAHDI is mono
    bitDepth: 16;      // DAHDI uses 16-bit
    format: 'linear' | 'alaw' | 'ulaw';
}

// Audio input type
export interface AudioInput {
    sampleRate: number;
    channels: number;
    bitDepth: number;
    data: Buffer;
    format?: string;
}
```

### Error Types
```typescript
// Error severity levels
export enum ErrorSeverity {
    LOW = 'low',
    MEDIUM = 'medium',
    HIGH = 'high',
    CRITICAL = 'critical'
}

// Error context
export interface ErrorContext {
    component: string;
    operation: string;
    severity: ErrorSeverity;
    retryCount: number;
    isRecoverable: boolean;
    metadata?: Record<string, unknown>;
}

// Service error
export interface ServiceError extends Error {
    name: 'ServiceError';
    serviceName: string;
    severity: ErrorSeverity;
    timestamp: Date;
}
```

### Logging Types
```typescript
// Log levels
export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

// Base log metadata
export interface BaseLogMetadata {
    component: LogComponent;
    type: LogMetadataType;
    timestamp: string;
    details?: Record<string, unknown>;
}

// Error log metadata
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

// Component types
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

// Metadata types
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
```

## Error Handling Strategy

### Error Types Hierarchy
1. Base Errors
   - IrohError (base class)
   - HardwareError
   - ServiceError
   - ConfigurationError
   - ValidationError

2. Error Classification
   - Severity levels
   - Component association
   - Recovery options

### Error Recovery Process
1. Detection & Logging
   - Record full error context
   - Log with appropriate severity
   - Track error frequency

2. Recovery Strategy
   - Attempt automatic recovery
   - Fallback procedures
   - Escalation path

3. Error Prevention
   - Type validation
   - Input sanitization
   - State verification

## Logging Requirements

### Log Entry Structure
1. Required Fields
   - Timestamp
   - Component
   - Log level
   - Message
   - Metadata

2. Metadata Validation
   - Component validation
   - Type checking
   - Required fields verification

3. Context Requirements
   - Error context
   - Operation context
   - State information

## Implementation Rules

### Service Implementation
1. Core Requirements
   - Must implement Service interface
   - Must handle typed events
   - Must manage state
   - Must implement error recovery

2. Event Handling
   - Type-safe event emission
   - Proper event context
   - Error event handling

3. Configuration
   - Type-safe config
   - Validation
   - Defaults

### Testing Requirements
1. Service Tests
   - Interface compliance
   - Event handling
   - Error recovery
   - State management

2. Integration Tests
   - Cross-service interaction
   - Error propagation
   - State coordination

### Security Considerations
1. Error Handling
   - Safe error messages
   - Secure logging
   - Error sanitization

2. Input Validation
   - Type checking
   - Sanitization
   - Boundary checking

This specification serves as the authoritative reference for implementing the Iroh system. All components must adhere to these requirements to maintain system integrity and type safety.
