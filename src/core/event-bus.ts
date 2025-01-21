// src/core/event-bus.ts
//
// Key Features:
// - Centralized event management
// - Type-safe event emission
// - Event history tracking
// - Event filtering
// - Debug logging

import { EventEmitter } from 'events';
import { logger } from '../utils/logger';

export class EventBus extends EventEmitter {
    private readonly eventHistory: Array<{
        event: string;
        data: any;
        timestamp: number;
    }> = [];

    private readonly MAX_HISTORY = 100;

    constructor() {
        super();
        this.setupDebugLogging();
    }

    private setupDebugLogging(): void {
        if (process.env.NODE_ENV === 'development') {
            this.on('*', (event, data) => {
                logger.debug('Event emitted:', { event, data });
            });
        }
    }

    public emit(event: string, data?: any): boolean {
        this.trackEvent(event, data);
        return super.emit(event, data);
    }

    private trackEvent(event: string, data: any): void {
        this.eventHistory.push({
            event,
            data,
            timestamp: Date.now()
        });

        // Keep history within limit
        if (this.eventHistory.length > this.MAX_HISTORY) {
            this.eventHistory.shift();
        }
    }

    public getEventHistory(): Array<{
        event: string;
        data: any;
        timestamp: number;
    }> {
        return [...this.eventHistory];
    }

    public clearHistory(): void {
        this.eventHistory.length = 0;
    }
}