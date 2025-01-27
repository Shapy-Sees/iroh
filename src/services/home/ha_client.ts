// src/services/home/ha_client.ts
//
// Home Assistant API client implementation
// This client handles all direct HTTP interactions with the Home Assistant API,
// including authentication, state management, and service calls.
// It provides a type-safe interface for the HA service layer.

import axios, { AxiosInstance, AxiosError } from 'axios';
import { EventEmitter } from 'events';
import { logger } from '../../utils/logger';
import { HAEntity, HAServiceCall } from './types';

export interface HAClientConfig {
    url: string;
    token: string;
    retryAttempts?: number;
    retryDelay?: number;
}

export class HAClient extends EventEmitter {
    private client: AxiosInstance;
    private readonly config: Required<HAClientConfig>;
    private isConnected: boolean = false;

    constructor(config: HAClientConfig) {
        super();
        
        // Set default configuration
        this.config = {
            retryAttempts: 3,
            retryDelay: 1000,
            ...config
        };

        // Initialize axios client
        this.client = axios.create({
            baseURL: this.config.url,
            headers: {
                'Authorization': `Bearer ${this.config.token}`,
                'Content-Type': 'application/json',
            },
            timeout: 10000
        });

        // Add response interceptor for error handling
        this.client.interceptors.response.use(
            response => response,
            this.handleRequestError.bind(this)
        );

        logger.info('Home Assistant client initialized', {
            url: this.config.url
        });
    }

    public async connect(): Promise<void> {
        try {
            // Test connection by getting API status
            const response = await this.client.get('/api/');
            this.isConnected = true;
            
            logger.info('Connected to Home Assistant', {
                version: response.data.version,
                message: response.data.message
            });
            
            this.emit('connected');
        } catch (error) {
            this.isConnected = false;
            logger.error('Failed to connect to Home Assistant:', error);
            throw error;
        }
    }

    public async getState(entityId: string): Promise<HAEntity> {
        try {
            logger.debug('Getting entity state', { entityId });
            const response = await this.client.get(`/api/states/${entityId}`);
            return response.data;
        } catch (error) {
            logger.error('Failed to get entity state:', error);
            throw this.wrapError(error);
        }
    }

    public async getAllStates(): Promise<HAEntity[]> {
        try {
            logger.debug('Getting all entity states');
            const response = await this.client.get('/api/states');
            return response.data;
        } catch (error) {
            logger.error('Failed to get all states:', error);
            throw this.wrapError(error);
        }
    }

    public async callService(params: HAServiceCall): Promise<void> {
        try {
            const { domain, service, target, service_data } = params;
            logger.debug('Calling Home Assistant service', { 
                domain, 
                service,
                target 
            });

            await this.client.post(
                `/api/services/${domain}/${service}`,
                {
                    ...service_data,
                    ...target
                }
            );
        } catch (error) {
            logger.error('Failed to call service:', error);
            throw this.wrapError(error);
        }
    }

    private async handleRequestError(error: AxiosError): Promise<never> {
        if (!error.response) {
            // Network error or timeout
            logger.error('Network error communicating with Home Assistant:', error);
            this.emit('connection_error', error);
            throw new Error('Network error communicating with Home Assistant');
        }

        switch (error.response.status) {
            case 401:
                logger.error('Unauthorized - invalid Home Assistant token');
                throw new Error('Invalid Home Assistant authentication token');
            case 404:
                logger.error('Entity or service not found:', error.config?.url);
                throw new Error('Entity or service not found');
            default:
                logger.error('Home Assistant API error:', error);
                throw new Error(`Home Assistant API error: ${error.message}`);
        }
    }

    private wrapError(error: unknown): Error {
        if (error instanceof Error) return error;
        return new Error(String(error));
    }

    public isHealthy(): boolean {
        return this.isConnected;
    }

    public async shutdown(): Promise<void> {
        logger.info('Shutting down Home Assistant client');
        this.isConnected = false;
        this.removeAllListeners();
    }
}