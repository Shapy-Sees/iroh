// src/services/home/ha_service.ts
//
// Home Assistant service layer implementation
// This service provides high-level interface for smart home control,
// manages state caching, and handles real-time updates through the HA API.
// It abstracts the Home Assistant complexity from the rest of the application.

import { EventEmitter } from 'events';
import { HAClient } from './ha_client';
import { Cache } from '../../utils/cache';
import { logger } from '../../utils/logger';
import { Service, ServiceStatus } from '../../types/services';
import { 
    HAEntity, 
    HAConfig, 
    HAServiceCall,
} from './types';

type EntityStateHandler = (entityId: string, state: HAEntity) => Promise<void>;

export class HAService extends EventEmitter implements Service {
    private client: HAClient;
    private cache: Cache;
    private updateInterval: NodeJS.Timeout | null = null;
    private stateHandlers: Map<string, EntityStateHandler[]> = new Map();
    private readonly config: Required<HAServiceConfig>;

    constructor(config: HAServiceConfig) {
        super();
        
        this.config = {
            entityPrefix: 'iroh_',
            updateInterval: 5000,  // 5 seconds
            cacheTimeout: 60000,   // 1 minute
            ...config
        };

        // Initialize Home Assistant client
        this.client = new HAClient({
            url: config.url,
            token: config.token
        });

        // Initialize cache
        this.cache = new Cache({
            namespace: 'ha-states',
            ttl: this.config.cacheTimeout
        });

        // Set up event handlers
        this.setupEventHandlers();
    }

    private setupEventHandlers(): void {
        this.client.on('connected', () => {
            logger.info('Home Assistant service ready');
            this.emit('ready');
        });

        this.client.on('connection_error', (error) => {
            logger.error('Home Assistant connection error:', error);
            this.emit('error', error);
        });
    }

    public async initialize(): Promise<void> {
        try {
            logger.info('Initializing Home Assistant service');
            
            // Connect to Home Assistant
            await this.client.connect();
            
            // Start state updates
            this.startStateUpdates();
            
            logger.info('Home Assistant service initialized');
        } catch (error) {
            logger.error('Failed to initialize Home Assistant service:', error);
            throw error;
        }
    }

    private startStateUpdates(): void {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }

        this.updateInterval = setInterval(async () => {
            try {
                await this.updateStates();
            } catch (error) {
                logger.error('Error updating states:', error);
            }
        }, this.config.updateInterval);
    }

    private async updateStates(): Promise<void> {
        const states = await this.client.getAllStates();
        
        for (const state of states) {
            // Only process our entities
            if (state.entity_id.startsWith(this.config.entityPrefix)) {
                const cached = await this.cache.get<HAEntity>(state.entity_id);
                
                // Check if state has changed
                if (!cached || cached.state !== state.state) {
                    await this.cache.set(state.entity_id, state);
                    await this.notifyStateHandlers(state.entity_id, state);
                }
            }
        }
    }

    public async getEntityState(entityId: string): Promise<HAEntity | null> {
        try {
            // Check cache first
            const cached = await this.cache.get<HAEntity>(entityId);
            if (cached) return cached;

            // Get fresh state from HA
            const state = await this.client.getState(entityId);
            await this.cache.set(entityId, state);
            return state;
        } catch (error) {
            logger.error('Error getting entity state:', error);
            return null;
        }
    }

    public async executeCommand(command: string, params?: Record<string, any>): Promise<void> {
        logger.info('Executing Home Assistant command', { command, params });

        try {
            // Parse command into domain and service
            const [domain, service] = command.split('.');
            if (!domain || !service) {
                throw new Error(`Invalid command format: ${command}`);
            }

            const serviceCall: HAServiceCall = {
                domain,
                service,
                service_data: params
            };

            await this.client.callService(serviceCall);
            logger.debug('Command executed successfully', { command });
        } catch (error) {
            logger.error('Error executing command:', error);
            throw error;
        }
    }

    public onEntityState(entityId: string, handler: EntityStateHandler): void {
        const handlers = this.stateHandlers.get(entityId) || [];
        handlers.push(handler);
        this.stateHandlers.set(entityId, handlers);
    }

    private async notifyStateHandlers(entityId: string, state: HAEntity): Promise<void> {
        const handlers = this.stateHandlers.get(entityId) || [];
        
        for (const handler of handlers) {
            try {
                await handler(entityId, state);
            } catch (error) {
                logger.error('Error in state handler:', error);
            }
        }

        // Emit change event
        this.emit('state_changed', {
            entityId,
            state
        });
    }

    public async turnOn(entityId: string): Promise<void> {
        await this.executeCommand('homeassistant.turn_on', {
            entity_id: entityId
        });
    }

    public async turnOff(entityId: string): Promise<void> {
        await this.executeCommand('homeassistant.turn_off', {
            entity_id: entityId
        });
    }

    public async setLight(entityId: string, params: {
        brightness?: number;
        color?: string;
        effect?: string;
    }): Promise<void> {
        await this.executeCommand('light.turn_on', {
            entity_id: entityId,
            ...params
        });
    }

    public async activateScene(sceneId: string): Promise<void> {
        await this.executeCommand('scene.turn_on', {
            entity_id: sceneId
        });
    }

    public getStatus(): ServiceStatus {
        return {
            state: this.client.isHealthy() ? 'ready' : 'error',
            isHealthy: this.client.isHealthy(),
            lastUpdate: new Date()
        };
    }

    public async shutdown(): Promise<void> {
        logger.info('Shutting down Home Assistant service');

        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }

        await this.client.shutdown();
        await this.cache.shutdown();
        this.removeAllListeners();
    }

    public isHealthy(): boolean {
        return this.client.isHealthy();
    }
}