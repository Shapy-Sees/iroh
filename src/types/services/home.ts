// Home Assistant service types

export interface HomeConfig {
    /** URL for Home Assistant instance */
    url: string;
    /** Access token for Home Assistant */
    token: string;
    /** Entity prefix for Home Assistant */
    entityPrefix?: string;
    /** Update interval in milliseconds */
    updateInterval?: number;
    /** HomeKit bridge configuration */
    homekitBridge?: {
        /** Bridge PIN code */
        pin: string;
        /** Bridge name */
        name: string;
        /** Bridge port number */
        port: number;
        /** Optional setup code */
        setupCode?: string;
    };
}

export interface HAEntity {
    entity_id: string;
    state: string;
    attributes: Record<string, any>;
    last_changed: string;
    last_updated: string;
    context?: {
        id: string;
        parent_id?: string;
        user_id?: string;
    };
}

export interface HAServiceCall {
    domain: string;
    service: string;
    target?: {
        entity_id?: string | string[];
        device_id?: string | string[];
        area_id?: string | string[];
    };
    service_data?: Record<string, any>;
} 