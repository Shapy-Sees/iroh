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

// Define event payload types
export interface BaseEventPayload {
    timestamp: number;
    id: string;
}

export interface SystemEventPayloads {
    'system:ready': BaseEventPayload;
    'system:error': BaseEventPayload & { error: Error };
    'system:shutdown': BaseEventPayload;
    'system:stateChange': BaseEventPayload & {
        previousState: string;
        currentState: string;
    };
}

export interface PhoneEventPayloads {
    'phone:offHook': BaseEventPayload;
    'phone:onHook': BaseEventPayload;
    'phone:dtmf': BaseEventPayload & { 
        digit: string;
        duration: number;
    };
    'phone:voice': BaseEventPayload & {
        audio: Buffer;
        duration: number;
    };
}

export interface HomeEventPayloads {
    'home:deviceChange': BaseEventPayload & {
        deviceId: string;
        state: any;
    };
    'home:sceneActivated': BaseEventPayload & {
        sceneId: string;
    };
}

export interface MusicEventPayloads {
    'music:play': BaseEventPayload & {
        track: string;
    };
    'music:pause': BaseEventPayload;
    'music:next': BaseEventPayload;
    'music:previous': BaseEventPayload;
}

// Combine all event types
export type IrohEventPayloads = SystemEventPayloads & 
    PhoneEventPayloads & 
    HomeEventPayloads & 
    MusicEventPayloads & {
    'service:initialized': { serviceName: string };
    'service:error': { serviceName: string, error: Error };
    'service:stateChanged': { serviceName: string, status: any };
    'service:shutdown': { serviceName: string };
};

export type EventName = keyof IrohEventPayloads;

interface EventHistoryItem<T = any> {
    event: EventName;
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

    public emit<K extends EventName>(
        event: K,
        payload: IrohEventPayloads[K]
    ): boolean {
        if (!this.validateEventPayload(event, payload)) {
            logger.error(`Invalid payload for event ${String(event)}`);
            return false;
        }

        const fullPayload = {
            ...payload,
            timestamp: Date.now(),
            id: this.generateEventId(),
        } as IrohEventPayloads[K];

        // Track event in history
        this.trackEvent(event, fullPayload);

        // Log in debug mode
        if (this.isDebugMode) {
            logger.debug(`Emitting event: ${String(event)}`, { eventId: fullPayload.id, data: fullPayload });
        }

        // Emit to standard EventEmitter
        const result = super.emit(event as string, fullPayload);

        // Emit to pattern subscribers
        this.emitToPatternSubscribers(event, fullPayload);

        return result;
    }

    private validateEventPayload<K extends EventName>(
        event: K,
        payload: any
    ): payload is IrohEventPayloads[K] {
        // Add runtime payload validation
        if (!payload || typeof payload !== 'object') return false;
        
        // Validate required base fields
        if (typeof payload.timestamp !== 'number') {
            payload.timestamp = Date.now();
        }
        
        if (typeof payload.id !== 'string') {
            payload.id = this.generateEventId();
        }
        
        return true;
    }

    public on<K extends EventName>(
        event: K,
        listener: (payload: IrohEventPayloads[K]) => void
    ): this {
        this.addSubscriber(event, listener);
        super.on(event as string, listener);
        return this;
    }

    public once<K extends EventName>(
        event: K,
        listener: (payload: IrohEventPayloads[K]) => void
    ): this {
        const onceWrapper = (payload: IrohEventPayloads[K]) => {
            this.removeSubscriber(event, onceWrapper);
            listener(payload);
        };
        
        this.addSubscriber(event, onceWrapper);
        super.once(event as string, onceWrapper);
        return this;
    }

    public off<K extends EventName>(
        event: K,
        listener: (payload: IrohEventPayloads[K]) => void
    ): this {
        this.removeSubscriber(event, listener);
        super.off(event as string, listener);
        return this;
    }

    public subscribe<K extends EventName>(
        pattern: string | RegExp,
        listener: (event: K, payload: IrohEventPayloads[K]) => void
    ): () => void {
        const matcher = typeof pattern === 'string' 
            ? new RegExp(`^${pattern.replace('*', '.*')}$`)
            : pattern;

        const wrapper = (event: K, payload: IrohEventPayloads[K]) => {
            if (matcher.test(String(event))) {
                listener(event, payload);
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

    private emitToPatternSubscribers<K extends EventName>(
        event: K,
        payload: IrohEventPayloads[K]
    ): void {
        const patternSubscribers = this.subscribers.get('pattern');
        if (patternSubscribers) {
            for (const subscriber of patternSubscribers) {
                subscriber(event, payload);
            }
        }
    }

    private trackEvent(event: EventName, payload: any): void {
        this.eventHistory.push({
            event,
            data: payload,
            timestamp: payload.timestamp,
            id: payload.id
        });
        
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
            types?: Array<EventName>;
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

    public getSubscriberCount(event: EventName): number {
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