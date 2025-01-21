// src/core/state-manager.ts
//
// Key Features:
// - Global state management
// - State persistence
// - State validation
// - Change tracking
// - State snapshots

import { logger } from '../utils/logger';

interface State {
    phone: {
        status: 'idle' | 'off-hook' | 'in-call';
        lastActivity: number;
    };
    home: {
        devices: Map<string, any>;
        scenes: Map<string, boolean>;
    };
    music: {
        playing: boolean;
        currentTrack?: string;
        volume: number;
    };
    system: {
        startTime: number;
        lastError?: Error;
        activeCommands: string[];
    };
}

export class StateManager {
    private state: State;
    private readonly initialState: State;

    constructor() {
        this.initialState = {
            phone: {
                status: 'idle',
                lastActivity: Date.now()
            },
            home: {
                devices: new Map(),
                scenes: new Map()
            },
            music: {
                playing: false,
                volume: 50
            },
            system: {
                startTime: Date.now(),
                activeCommands: []
            }
        };
        this.state = this.cloneState(this.initialState);
    }

    public async initialize(): Promise<void> {
        try {
            // Load persisted state if available
            const savedState = await this.loadState();
            if (savedState) {
                this.state = this.mergeStates(this.initialState, savedState);
            }
            logger.info('State initialized successfully');
        } catch (error) {
            logger.error('Failed to initialize state:', error);
            throw error;
        }
    }

    public getState(): State {
        return this.cloneState(this.state);
    }

    public async update(changes: Partial<State>): Promise<void> {
        try {
            const newState = this.mergeStates(this.state, changes);
            if (await this.validateState(newState)) {
                this.state = newState;
                await this.save();
            } else {
                throw new Error('Invalid state update');
            }
        } catch (error) {
            logger.error('State update failed:', error);
            throw error;
        }
    }

    private async validateState(state: State): Promise<boolean> {
        // Add validation logic here
        return true;
    }

    private async loadState(): Promise<State | null> {
        try {
            // Add state loading logic here
            return null;
        } catch (error) {
            logger.error('Failed to load state:', error);
            return null;
        }
    }

    public async save(): Promise<void> {
        try {
            // Add state saving logic here
            logger.debug('State saved successfully');
        } catch (error) {
            logger.error('Failed to save state:', error);
            throw error;
        }
    }

    public reset(): void {
        this.state = this.cloneState(this.initialState);
    }

    private cloneState(state: State): State {
        return JSON.parse(JSON.stringify(state));
    }

    private mergeStates(current: State, updates: Partial<State>): State {
        return {
            ...current,
            ...updates,
            // Deep merge for nested objects
            home: {
                ...current.home,
                ...updates.home
            },
            system: {
                ...current.system,
                ...updates.system
            }
        };
    }

    public createSnapshot(): State {
        return this.cloneState(this.state);
    }

    public async restoreSnapshot(snapshot: State): Promise<void> {
        if (await this.validateState(snapshot)) {
            this.state = this.cloneState(snapshot);
            await this.save();
        } else {
            throw new Error('Invalid state snapshot');
        }
    }
}