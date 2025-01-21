// File: src/types/cache.ts
//
// Description:
// Type definitions for the caching system.
// Contains interfaces and types used by the cache implementation
// and its consumers throughout the project.
//
// Usage:
// Import in other modules like:
// import { CacheOptions, CacheEvents } from '../types/cache';

export interface CacheOptions {
    /** Time to live in milliseconds */
    ttl?: number;
    
    /** Maximum number of items in cache */
    maxSize?: number;
    
    /** Namespace for the cache instance */
    namespace?: string;
}

export interface CacheItem<T> {
    /** The cached value */
    value: T;
    
    /** Timestamp when the item expires */
    expires: number;
}

export interface CacheEvents {
    'set': { key: string; value: any };
    'hit': { key: string };
    'delete': { key: string };
    'clear': void;
    'evict': { key: string };
    'expire': { key: string };
}