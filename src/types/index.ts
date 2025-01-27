// src/types/index.ts
//
// Consolidated type definitions for the entire Iroh project.
// This is the single source of truth for all type definitions,
// providing consistent typing across all components.

import { Buffer } from 'buffer';

// Export core types
export * from './core';
export * from './errors';
export * from './logging';

// Export service types
export * from './services';

// Export hardware types
export * from './hardware/audio';
export * from './hardware/dahdi';
export * from './hardware/fxs';

// Export specific interfaces
export interface Config {
    app: AppConfig;
    audio: AudioConfig;
    logging: LogConfig;
    services: ServiceConfig;
}

// Remove duplicate interface definitions and use imports
export type { AppConfig, LogConfig } from './core';
export type { AudioConfig, ServiceConfig } from './services';