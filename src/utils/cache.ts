import { 
    CacheOptions,
    CacheItem,
    CacheEvents,
    Result 
} from '../types/core';

import { EventEmitter } from 'events';
import { logger } from './logger';

export class Cache extends EventEmitter {
    private store: Map<string, CacheItem<any>>;
    private readonly options: Required<CacheOptions>;
    private cleanupInterval: NodeJS.Timeout | null;

    constructor(options: CacheOptions = {}) {
        super();
        this.store = new Map();
        this.options = {
            ttl: 24 * 60 * 60 * 1000, // 24 hours default
            maxSize: 1000,             // 1000 items default
            namespace: 'default',
            ...options
        };

        this.cleanupInterval = null;
        this.startCleanup();
    }

    public async set<T>(key: string, value: T, ttl?: number): Promise<void> {
        try {
            // Check cache size before adding
            if (this.store.size >= this.options.maxSize) {
                this.evictOldest();
            }

            const expires = Date.now() + (ttl || this.options.ttl);
            const namespacedKey = this.getNamespacedKey(key);

            this.store.set(namespacedKey, { value, expires });
            this.emit('set', { key: namespacedKey, value });

            logger.debug('Cache item set', { 
                namespace: this.options.namespace,
                key: namespacedKey 
            });
        } catch (error) {
            logger.error('Error setting cache item:', error instanceof Error ? error : new Error(String(error)));
            throw error;
        }
    }

    public async get<T>(key: string): Promise<T | null> {
        try {
            const namespacedKey = this.getNamespacedKey(key);
            const item = this.store.get(namespacedKey);

            if (!item) {
                return null;
            }

            // Check if item has expired
            if (Date.now() > item.expires) {
                this.delete(key);
                return null;
            }

            this.emit('hit', { key: namespacedKey });
            return item.value as T;
        } catch (error) {
            logger.error('Error getting cache item:', error instanceof Error ? error : new Error(String(error)));
            throw error;
        }
    }

    public async getOrSet<T>(
        key: string, 
        factory: () => Promise<T>,
        ttl?: number
    ): Promise<T> {
        const cached = await this.get<T>(key);
        if (cached !== null) {
            return cached;
        }

        const value = await factory();
        await this.set(key, value, ttl);
        return value;
    }

    public delete(key: string): boolean {
        const namespacedKey = this.getNamespacedKey(key);
        const result = this.store.delete(namespacedKey);
        
        if (result) {
            this.emit('delete', { key: namespacedKey });
            logger.debug('Cache item deleted', { 
                namespace: this.options.namespace,
                key: namespacedKey 
            });
        }
        
        return result;
    }

    public clear(): void {
        this.store.clear();
        this.emit('clear');
        logger.debug('Cache cleared', { namespace: this.options.namespace });
    }

    public size(): number {
        return this.store.size;
    }

    private getNamespacedKey(key: string): string {
        return `${this.options.namespace}:${key}`;
    }

    private evictOldest(): void {
        // Find the oldest item
        let oldestKey: string | null = null;
        let oldestTime = Infinity;

        for (const [key, item] of this.store.entries()) {
            if (item.expires < oldestTime) {
                oldestTime = item.expires;
                oldestKey = key;
            }
        }

        // Delete the oldest item
        if (oldestKey) {
            this.store.delete(oldestKey);
            this.emit('evict', { key: oldestKey });
            logger.debug('Cache item evicted', { 
                namespace: this.options.namespace,
                key: oldestKey 
            });
        }
    }

    private startCleanup(): void {
        // Run cleanup every minute
        this.cleanupInterval = setInterval(() => {
            this.cleanup();
        }, 60 * 1000);
    }

    private cleanup(): void {
        const now = Date.now();
        for (const [key, item] of this.store.entries()) {
            if (now > item.expires) {
                this.store.delete(key);
                this.emit('expire', { key });
            }
        }
    }

    public shutdown(): void {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
        this.removeAllListeners();
        this.store.clear();
    }
}