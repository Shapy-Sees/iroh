// src/types/index.ts
//
// Consolidated type definitions for the entire Iroh project.
// This is the single source of truth for all type definitions,
// providing consistent typing across all components.

import { Buffer } from 'buffer';

// Re-export all type definitions

// Core types and interfaces
export * from './core';

// Error handling
export * from './errors';

// Logging system
export * from './logging';

// Service related types
export * from './services';

// Hardware related types
export * from './hardware';

// Note: Remove duplicate interface definitions as they're now properly exported from core.ts