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

### Service Interface Requirements
```typescript
interface Service {
    initialize(): Promise<void>;
    shutdown(): Promise<void>;
    getStatus(): ServiceStatus;
    isHealthy(): boolean;
}

interface ServiceStatus {
    state: ServiceState;
    isHealthy: boolean;
    lastError?: Error;
    lastUpdate?: Date;
}

type ServiceState = 'initializing' | 'ready' | 'error' | 'shutdown' | 'maintenance';
```

### Status Management Requirements
- Services must maintain current state
- Must track health status
- Must record errors
- Must emit state change events
- Must provide accurate timestamps

### Controller Layer
- **Purpose**: Coordinates between hardware and services
- **Key Requirements**:
  - Manages component lifecycle
  - Handles cross-service operations
  - Implements command processing
  - Provides user feedback
  - Maintains type safety

### Support Systems
- **Purpose**: Provides cross-cutting functionality
- **Key Components**: Logging, Caching, Error Handling
- **Requirements**:
  - Must be available to all layers
  - Implements consistent interfaces
  - Provides configuration options
  - Maintains type safety

## Type System

### Core Types
```typescript
// Base configuration interface
export interface Config {
    app: AppConfig;
    audio: AudioConfig;
    logging: LogConfig;
    services: ServiceConfig;
}

// Service registry
export interface ServiceRegistry {
    ai: IrohAIService;
    home: HAService;
    music: MusicService;
    timer: TimerService;
    hardware: HardwareService;
}

// Event system types
export interface BaseEvent {
    type: string;
    timestamp: number;
    metadata?: Record<string, unknown>;
}

// Status tracking
export interface ServiceStatus {
    state: ServiceState;
    isHealthy: boolean;
    lastError?: Error;
    lastUpdate?: Date;
}
```

### Hardware Types
```typescript
// DAHDI Types
export interface DAHDIConfig {
    devicePath: string;
    controlPath: string;
    sampleRate: 8000;
    channels: 1;
    bitDepth: 16;
    bufferSize: number;
    channel: number;
    monitorInterval?: number;
}

// Audio Format
export interface DAHDIAudioFormat {
    sampleRate: 8000;
    channels: 1;
    bitDepth: 16;
    format: 'linear';
}
```

### Service Types
```typescript
// AI Service
export interface IrohAIService extends Service {
    processText(text: string): Promise<string>;
    generateSpeech(text: string): Promise<Buffer>;
    processTextStreaming(text: string): Promise<void>;
}

// Home Assistant
export interface HAService extends Service {
    controlDevice(deviceId: string, command: string): Promise<void>;
    getEntityState(entityId: string): Promise<HAEntityStatus>;
    onEntityState(entityId: string, handler: HAStateHandler): void;
}

// Music Service
export interface MusicService extends Service {
    play(track: string): Promise<void>;
    pause(): Promise<void>;
    stop(): Promise<void>;
    isPlaying(): boolean;
}

// Timer Service
export interface TimerService extends Service {
    createTimer(duration: number): Promise<string>;
    cancelTimer(timerId: string): Promise<void>;
    getActiveTimers(): string[];
}
```

### Logging Types
```typescript
export interface LogMetadata {
    component: string;
    type: string;
    timestamp: string;
    details?: Record<string, any>;
}

export interface ErrorLogMetadata extends LogMetadata {
    error: {
        message: string;
        name: string;
        code?: string;
        stack?: string;
    };
    severity: 'low' | 'medium' | 'high' | 'critical';
}
```

## Error Handling Strategy

### Error Types
1. Service Errors
   - Service state errors
   - Operation failures
   - Configuration errors
   - API failures

2. Hardware Errors
   - DAHDI device errors
   - Audio format errors
   - Buffer errors
   - Hardware timing errors

3. System Errors
   - Initialization failures
   - Resource exhaustion
   - Critical failures

### Error Recovery Process
1. Error Detection
   - Monitor service health
   - Track hardware status
   - Validate state transitions
   - Check resource usage

2. Recovery Strategy
   - Service restart
   - Hardware reset
   - State restoration
   - User notification

3. Status Management
   - Update service status
   - Record error details
   - Emit error events
   - Log with proper metadata

## Logging Requirements

Every component must implement comprehensive logging with type safety:

1. Log Levels
   - ERROR: System failures and errors
   - WARN: Potential issues and degraded operations
   - INFO: Major state changes and operations
   - DEBUG: Detailed operational information

2. Metadata Requirements
   - Must include component identification
   - Must include proper typing
   - Must include timestamps
   - Must include contextual details

3. Error Logging
   - Must use ErrorLogMetadata
   - Must include stack traces
   - Must specify severity
   - Must include context

## Implementation Rules

1. Service Implementation
   - Must implement Service interface
   - Must maintain status
   - Must handle errors properly
   - Must emit typed events

2. Type Safety
   - Use strict type checking
   - No implicit any
   - Proper interface implementation
   - Typed event emission

3. Error Handling
   - Use proper error types
   - Maintain status during errors
   - Implement recovery procedures
   - Log with typed metadata

4. Testing Requirements
   - Test all interface methods
   - Verify error handling
   - Test state transitions
   - Validate type safety

## Performance Requirements

1. Audio Processing
   - Maintain DAHDI compatibility
   - Handle real-time audio
   - Minimize latency
   - Optimize buffer usage

2. Service Operations
   - Fast state transitions
   - Efficient error handling
   - Optimized event emission
   - Quick status updates

3. Resource Management
   - Proper cleanup
   - Memory optimization
   - Buffer management
   - Connection pooling

## Security Considerations

1. API Security
   - Secure token handling
   - Input validation
   - Error sanitization
   - Safe logging practices

2. Error Handling
   - Safe error messages
   - Secure error logging
   - Protected stack traces
   - Sanitized user feedback

3. Resource Protection
   - Access control
   - Resource limits
   - Safe cleanup
   - Secure shutdown

This specification serves as the authoritative reference for implementing the Iroh system. All components must adhere to these requirements to maintain system integrity and type safety.