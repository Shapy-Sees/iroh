// src/types/index.ts
//
// Consolidated type definitions for the entire Iroh project.
// This is the single source of truth for all type definitions,
// providing consistent typing across all components.

import { Buffer } from 'buffer';

// Re-export all type definitions

// Core types and interfaces
export * from './core';

// Hardware related types
export * from './hardware';

// Service related types
export * from './services';

// Logging system
export * from './logging';

// Error handling
export * from './errors';