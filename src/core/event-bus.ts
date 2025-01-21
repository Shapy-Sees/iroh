// src/core/event-bus.ts
//
// A robust event bus implementation that provides:
// - Type-safe event emission and handling
// - Event history tracking with replay capability
// - Event filtering and pattern matching
// - Asynchronous event handling
// - Debug logging integration
// - Memory leak prevention

import { EventEmitter } from 'events';
import { logger } from '../utils/logger';

// Define standard event types
export interface SystemEvents {
    'system:ready': void;
    'system:error': Error;
    'system:shutdown': void;
}

export interface PhoneEvents {
    'phone:offHook': void;
    'phone:onHook': void;
    'phone:dtmf': { digit: string; duration: number };
    'phone:voice': { audio: Buffer; duration: number };
}

export interface HomeEvents {
    'home:deviceChange': { deviceId: string; state: any };
    'home:sceneActivated': { sceneId: string };
}

export interface MusicEvents {
    'music:play': { track: string };
    'music:pause': void;
    'music:next': void;
    'music:previous': void;
}

// Combine all event types
export type IrohEvents = SystemEvents & PhoneEvents & HomeEvents & MusicEvents;

interface EventHistoryItem<T = any> {
    event: keyof IrohEvents;
    data: T;
    timestamp: number;
    id: string;
}

export class EventBus extends EventEmitter {
    private readonly eventHistory: EventHistoryItem[] = [];
    private readonly MAX_HISTORY = 100;
    private readonly subscribers: Map<string, Set<Function>> = new Map();
    private isDebugMode: boolean;

    constructor(options: { debug?: boolean } = {}) {
        super();
        this.isDebugMode = options.debug || process.env.NODE_ENV === 'development';
        this.setupDebugLogging();
    }

    private setupDebugLogging(): void {
        if (this.isDebugMode) {
            this.on('*', (event, data) => {
                logger.debug('Event emitted:', {
                    event,
                    data,
                    subscribers: this.subscribers.get(event)?.size || 0
                });
            });
        }
    }

    public emit<K extends keyof IrohEvents>(
        event: K,
        data?: IrohEvents[K]
    ): boolean {
        const eventId = this.generateEventId();
        
        // Track event in history
        this.trackEvent({
            event,
            data,
            timestamp: Date.now(),
            id: eventId
        });

        // Log in debug mode
        if (this.isDebugMode) {
            logger.debug(`Emitting event: ${String(event)}`, { eventId, data });
        }

        // Emit to standard EventEmitter
        const result = super.emit(event as string, data);

        // Emit to pattern subscribers
        this.emitToPatternSubscribers(event, data);

        return result;
    }

    public on<K extends keyof IrohEvents>(
        event: K,
        listener: (data: IrohEvents[K]) => void
    ): this {
        this.addSubscriber(event, listener);
        super.on(event as string, listener);
        return this;
    }

    public once<K extends keyof IrohEvents>(
        event: K,
        listener: (data: IrohEvents[K]) => void
    ): this {
        const onceWrapper = (data: IrohEvents[K]) => {
            this.removeSubscriber(event, onceWrapper);
            listener(data);
        };
        
        this.addSubscriber(event, onceWrapper);
        super.once(event as string, onceWrapper);
        return this;
    }

    public off<K extends keyof IrohEvents>(
        event: K,
        listener: (data: IrohEvents[K]) => void
    ): this {
        this.removeSubscriber(event, listener);
        super.off(event as string, listener);
        return this;
    }

    public subscribe<K extends keyof IrohEvents>(
        pattern: string | RegExp,
        listener: (event: K, data: IrohEvents[K]) => void
    ): () => void {
        const matcher = typeof pattern === 'string' 
            ? new RegExp(`^${pattern.replace('*', '.*')}$`)
            : pattern;

        const wrapper = (event: K, data: IrohEvents[K]) => {
            if (matcher.test(String(event))) {
                listener(event, data);
            }
        };

        this.addSubscriber('pattern', wrapper);
        return () => this.removeSubscriber('pattern', wrapper);
    }

    private addSubscriber(event: string, listener: Function): void {
        const subscribers = this.subscribers.get(event) || new Set();
        subscribers.add(listener);
        this.subscribers.set(event, subscribers);
    }

    private removeSubscriber(event: string, listener: Function): void {
        const subscribers = this.subscribers.get(event);
        if (subscribers) {
            subscribers.delete(listener);
            if (subscribers.size === 0) {
                this.subscribers.delete(event);
            }
        }
    }

    private emitToPatternSubscribers<K extends keyof IrohEvents>(
        event: K,
        data: IrohEvents[K]
    ): void {
        const patternSubscribers = this.subscribers.get('pattern');
        if (patternSubscribers) {
            for (const subscriber of patternSubscribers) {
                subscriber(event, data);
            }
        }
    }

    private trackEvent(item: EventHistoryItem): void {
        this.eventHistory.push(item);
        
        // Keep history within limit
        while (this.eventHistory.length > this.MAX_HISTORY) {
            this.eventHistory.shift();
        }
    }

    public getEventHistory(): ReadonlyArray<EventHistoryItem> {
        return [...this.eventHistory];
    }

    public replayEvents(
        filter?: {
            after?: number;
            before?: number;
            types?: Array<keyof IrohEvents>;
        }
    ): void {
        let events = [...this.eventHistory];

        if (filter) {
            events = events.filter(item => {
                const timeMatch = (!filter.after || item.timestamp > filter.after) &&
                                (!filter.before || item.timestamp < filter.before);
                const typeMatch = !filter.types || filter.types.includes(item.event);
                return timeMatch && typeMatch;
            });
        }

        for (const event of events) {
            this.emit(event.event, event.data);
        }
    }

    private generateEventId(): string {
        return Math.random().toString(36).substr(2, 9);
    }

    public clearHistory(): void {
        this.eventHistory.length = 0;
    }

    public getSubscriberCount(event: keyof IrohEvents): number {
        return this.subscribers.get(String(event))?.size || 0;
    }

    public async shutdown(): Promise<void> {
        this.removeAllListeners();
        this.subscribers.clear();
        this.clearHistory();
    }
}

// Export singleton instance
export const eventBus = new EventBus({
    debug: process.env.NODE_ENV === 'development'
});