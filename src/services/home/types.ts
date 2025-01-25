// src/services/home/types.ts
//
// This file defines TypeScript interfaces and types for Home Assistant integration.
// It provides type definitions for both the low-level API client and high-level service layer.
// These types closely mirror Home Assistant's REST API structure and WebSocket API.

// Entity represents a Home Assistant entity with its state and attributes
export interface HAEntity {
    /** Unique entity identifier (e.g., 'light.living_room') */
    entity_id: string;
    
    /** Current state of the entity */
    state: string;
    
    /** Entity-specific attributes */
    attributes: Record<string, any>;
    
    /** Last time the state was changed */
    last_changed: string;
    
    /** Last time the state or attributes were updated */
    last_updated: string;
    
    /** Context information for state changes */
    context?: {
        id: string;
        parent_id?: string;
        user_id?: string;
    };
}

// Configuration for connecting to Home Assistant
export interface HAConfig {
    /** Home Assistant URL (e.g., 'http://homeassistant.local:8123') */
    url: string;
    
    /** Long-lived access token for authentication */
    token: string;
    
    /** Prefix for entity IDs created by this integration */
    entityPrefix?: string;
    
    /** How often to poll for updates (ms) */
    updateInterval?: number;
    
    /** Maximum retries for failed requests */
    maxRetries?: number;
    
    /** Delay between retries (ms) */
    retryDelay?: number;
    
    /** Connection timeout (ms) */
    timeout?: number;
}

// Service call parameters for Home Assistant
export interface HAServiceCall {
    /** Service domain (e.g., 'light', 'switch', 'automation') */
    domain: string;
    
    /** Service name (e.g., 'turn_on', 'toggle') */
    service: string;
    
    /** Service call targets */
    target?: {
        /** Target specific entities */
        entity_id?: string | string[];
        
        /** Target specific devices */
        device_id?: string | string[];
        
        /** Target specific areas */
        area_id?: string | string[];
    };
    
    /** Additional service parameters */
    service_data?: Record<string, any>;
}

// Event received from Home Assistant
export interface HAEvent {
    /** Event type */
    event_type: string;
    
    /** Time event was fired */
    time_fired: string;
    
    /** Event data */
    data: {
        entity_id?: string;
        old_state?: HAEntity;
        new_state?: HAEntity;
        [key: string]: any;
    };
    
    /** Event context */
    context: {
        id: string;
        parent_id?: string;
        user_id?: string;
    };
}

// State change subscription filter
export interface HAStateFilter {
    /** Entity IDs to monitor */
    entity_id?: string | string[];
    
    /** Domain to monitor (e.g., 'light') */
    domain?: string;
    
    /** Only report changes matching these states */
    state?: string | string[];
}

// Authentication result
export interface HAAuthResult {
    /** Access token */
    access_token: string;
    
    /** Token expiration timestamp */
    expires?: number;
    
    /** Token refresh information */
    refresh_token?: string;
}

// Error types for specific failure scenarios
export class HAError extends Error {
    constructor(message: string, public code: string) {
        super(message);
        this.name = 'HAError';
    }
}

export class HAConnectionError extends HAError {
    constructor(message: string) {
        super(message, 'CONNECTION_ERROR');
        this.name = 'HAConnectionError';
    }
}

export class HAAuthenticationError extends HAError {
    constructor(message: string) {
        super(message, 'AUTHENTICATION_ERROR');
        this.name = 'HAAuthenticationError';
    }
}

// Area represents a physical location in the home
export interface HAArea {
    /** Area identifier */
    area_id: string;
    
    /** Human-readable name */
    name: string;
    
    /** Optional picture */
    picture?: string;
}

// Device represents a physical device that may have multiple entities
export interface HADevice {
    /** Device identifier */
    id: string;
    
    /** Device name */
    name?: string;
    
    /** Device manufacturer */
    manufacturer?: string;
    
    /** Device model */
    model?: string;
    
    /** Area where device is located */
    area_id?: string;
    
    /** Associated entity IDs */
    entities: string[];
}

// Common state attributes for different entity types
export interface HALightAttributes {
    brightness?: number;
    color_temp?: number;
    rgb_color?: [number, number, number];
    supported_features?: number;
    friendly_name?: string;
}

export interface HASwitchAttributes {
    current_power_w?: number;
    total_energy_kwh?: number;
    friendly_name?: string;
}

export interface HAClimateAttributes {
    current_temperature?: number;
    temperature?: number;
    target_temp_high?: number;
    target_temp_low?: number;
    hvac_action?: string;
    friendly_name?: string;
}

// Service status and metrics
export interface HAServiceStatus {
    /** Whether service is connected */
    isConnected: boolean;
    
    /** Number of entities being tracked */
    entityCount: number;
    
    /** Last successful update time */
    lastUpdate: Date;
    
    /** Connection uptime in seconds */
    uptime: number;
    
    /** Number of active subscriptions */
    subscriptions: number;
}