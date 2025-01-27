import { EventEmitter } from 'events';
import { HAClient } from './ha_client';
import { Service, ServiceStatus } from '../../types/services';
import { HomeConfig } from '../../types/services/home';
import { logger } from '../../utils/logger';

interface HAServiceEvents {
    'state_changed': (entityId: string, state: HAEntityStatus) => void;
    'ready': () => void;
    'error': (error: Error) => void;
}

interface HAEntityStatus {
    entityId: string;
    state: any;
    attributes: Record<string, any>;
    lastChanged: Date;
}

type HAStateHandler = (entityId: string, state: HAEntityStatus) => Promise<void>;

export class HAService extends EventEmitter implements Service {
    private client: HAClient;
    private stateHandlers: Map<string, HAStateHandler[]> = new Map();
    private status: ServiceStatus = { state: 'initializing' };
    private updateInterval: NodeJS.Timer | null = null;

    constructor(public readonly config: HomeConfig) {
        super();
        this.client = new HAClient({
            url: config.url,
            token: config.token
        });
    }

    public async initialize(): Promise<void> {
        try {
            logger.info('Initializing Home Assistant service');
            this.status = { state: 'initializing' };

            await this.client.connect();
            this.setupEventHandlers();
            this.startStateUpdates();

            this.status = { state: 'ready' };
            this.emit('ready');
        } catch (error) {
            this.status = { state: 'error', error: error as Error };
            logger.error('Failed to initialize Home Assistant service:', error);
            throw error;
        }
    }

    private setupEventHandlers(): void {
        this.client.on('connected', () => {
            this.status = { state: 'ready' };
            this.emit('ready');
        });

        this.client.on('connection_error', (error) => {
            this.status = { state: 'error', error };
            this.emit('error', error);
        });
    }

    public async controlDevice(deviceId: string, command: string): Promise<void> {
        try {
            const [domain, service] = command.split('.');
            if (!domain || !service) {
                throw new Error(`Invalid command format: ${command}`);
            }

            await this.client.callService({
                domain,
                service,
                target: { entity_id: deviceId }
            });
        } catch (error) {
            logger.error('Error controlling device:', error);
            throw error;
        }
    }

    public async getEntityState(entityId: string): Promise<HAEntityStatus> {
        try {
            const state = await this.client.getState(entityId);
            return {
                entityId: state.entity_id,
                state: state.state,
                attributes: state.attributes,
                lastChanged: new Date(state.last_changed)
            };
        } catch (error) {
            logger.error('Error getting entity state:', error);
            throw error;
        }
    }

    public onEntityState(entityId: string, handler: HAStateHandler): void {
        const handlers = this.stateHandlers.get(entityId) || [];
        handlers.push(handler);
        this.stateHandlers.set(entityId, handlers);
    }

    private startStateUpdates(): void {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }

        this.updateInterval = setInterval(async () => {
            try {
                const states = await this.client.getAllStates();
                for (const state of states) {
                    await this.processStateUpdate(state);
                }
            } catch (error) {
                logger.error('Error updating states:', error);
            }
        }, this.config.updateInterval || 5000);
    }

    private async processStateUpdate(state: any): Promise<void> {
        const handlers = this.stateHandlers.get(state.entity_id) || [];
        const status: HAEntityStatus = {
            entityId: state.entity_id,
            state: state.state,
            attributes: state.attributes,
            lastChanged: new Date(state.last_changed)
        };

        for (const handler of handlers) {
            try {
                await handler(state.entity_id, status);
            } catch (error) {
                logger.error('Error in state handler:', error);
            }
        }

        this.emit('state_changed', state.entity_id, status);
    }

    public getStatus(): ServiceStatus {
        return this.status;
    }

    public isHealthy(): boolean {
        return this.status.state === 'ready' && this.client.isHealthy();
    }

    public async shutdown(): Promise<void> {
        logger.info('Shutting down Home Assistant service');
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }

        await this.client.shutdown();
        this.removeAllListeners();
        this.status = { state: 'shutdown' };
    }

    // Type-safe event emitter
    emit<K extends keyof HAServiceEvents>(
        event: K, 
        ...args: Parameters<HAServiceEvents[K]>
    ): boolean {
        return super.emit(event, ...args);
    }

    on<K extends keyof HAServiceEvents>(
        event: K, 
        listener: HAServiceEvents[K]
    ): this {
        return super.on(event, listener);
    }
}