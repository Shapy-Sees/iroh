// src/services/intent/intent-handler.ts
//
// Enhanced intent handling system that provides:
// - Flexible intent matching
// - Keyword-based intent detection
// - Configurable action mapping
// - Score-based intent resolution
// - Context awareness
// - Extensible intent definitions

import { EventEmitter } from 'node:events';
import { logger } from '../../utils/logger';

// Define core intent types
export type IntentType = 
    | 'MUSIC_CONTROL'
    | 'LIGHT_CONTROL'
    | 'TEMPERATURE_CONTROL'
    | 'TIMER_CONTROL'
    | 'GENERAL_QUERY'
    | 'UNKNOWN';

// Define specific actions for each intent type
export type IntentAction =
    | 'PLAY_MUSIC'
    | 'PAUSE_MUSIC'
    | 'NEXT_TRACK'
    | 'PREVIOUS_TRACK'
    | 'SET_VOLUME'
    | 'TOGGLE_LIGHTS'
    | 'DIM_LIGHTS'
    | 'BRIGHTEN_LIGHTS'
    | 'SET_TEMPERATURE'
    | 'ADJUST_TEMPERATURE'
    | 'SET_TIMER'
    | 'CANCEL_TIMER'
    | 'CHECK_TIMER'
    | 'GENERAL_QUERY';

interface IntentDefinition {
    type: IntentType;
    action: IntentAction;
    keywords: string[];
    patterns: RegExp[];
    contextKeywords?: string[];
    priority?: number;
    requiresContext?: boolean;
}

interface IntentMatch {
    intent: IntentDefinition;
    score: number;
    matches: string[];
    parameters?: Record<string, any>;
}

interface IntentContext {
    previousIntent?: IntentType;
    timestamp: number;
    parameters?: Record<string, any>;
}

// Add interface for IntentHandler events
interface IntentHandlerEvents {
    'contextUpdate': (context: IntentContext | null) => void;
}

export class IntentHandler extends EventEmitter {
    private intents: Map<IntentAction, IntentDefinition>;
    private context: IntentContext | null = null;
    private readonly confidenceThreshold: number = 0.6;

    constructor() {
        super();
        this.intents = this.initializeIntents();
        logger.info('Intent handler initialized');
    }

    private initializeIntents(): Map<IntentAction, IntentDefinition> {
        const intents = new Map<IntentAction, IntentDefinition>();

        // Music control intents
        intents.set('PLAY_MUSIC', {
            type: 'MUSIC_CONTROL',
            action: 'PLAY_MUSIC',
            keywords: ['play', 'start', 'music', 'song', 'track', 'listen'],
            patterns: [
                /\b(?:play|start)\s+(?:some\s+)?(?:music|song|track)\b/i,
                /\bput\s+on\s+(?:some\s+)?music\b/i
            ],
            priority: 1
        });

        // Light control intents
        intents.set('TOGGLE_LIGHTS', {
            type: 'LIGHT_CONTROL',
            action: 'TOGGLE_LIGHTS',
            keywords: ['lights', 'light', 'switch', 'turn', 'on', 'off'],
            patterns: [
                /\bturn\s+(?:the\s+)?lights?\s+(?:on|off)\b/i,
                /\blights?\s+(?:on|off)\b/i
            ],
            contextKeywords: ['room', 'kitchen', 'bedroom', 'living room'],
            priority: 1
        });

        // Temperature control intents
        intents.set('SET_TEMPERATURE', {
            type: 'TEMPERATURE_CONTROL',
            action: 'SET_TEMPERATURE',
            keywords: ['temperature', 'thermostat', 'degrees', 'warm', 'cool'],
            patterns: [
                /\bset\s+(?:the\s+)?temp(?:erature)?\s+to\s+(\d+)\s*(?:degrees?)?\b/i,
                /\bmake\s+it\s+(?:warmer|cooler)\b/i
            ],
            priority: 1
        });

        // Timer control intents
        intents.set('SET_TIMER', {
            type: 'TIMER_CONTROL',
            action: 'SET_TIMER',
            keywords: ['timer', 'remind', 'alarm', 'minutes', 'hours'],
            patterns: [
                /\bset\s+(?:a\s+)?timer\s+for\s+(\d+)\s*(minute|hour)s?\b/i,
                /\bremind\s+me\s+in\s+(\d+)\s*(minute|hour)s?\b/i
            ],
            priority: 2
        });

        return intents;
    }

    public async detectIntent(input: string): Promise<IntentMatch | null> {
        logger.debug('Detecting intent from input', { input });
        
        const matches: IntentMatch[] = [];

        // Check each intent definition
        for (const intent of this.intents.values()) {
            const score = this.calculateIntentScore(input, intent);
            if (score >= this.confidenceThreshold) {
                matches.push({
                    intent,
                    score,
                    matches: this.extractMatches(input, intent),
                    parameters: this.extractParameters(input, intent)
                });
            }
        }

        // Sort matches by score and priority
        matches.sort((a, b) => {
            const priorityDiff = (b.intent.priority || 0) - (a.intent.priority || 0);
            return priorityDiff !== 0 ? priorityDiff : b.score - a.score;
        });

        const bestMatch = matches[0];
        if (bestMatch) {
            logger.info('Intent detected', {
                type: bestMatch.intent.type,
                action: bestMatch.intent.action,
                score: bestMatch.score,
                parameters: bestMatch.parameters
            });
            
            // Update context
            this.updateContext(bestMatch);
        }

        return bestMatch || null;
    }

    private calculateIntentScore(input: string, intent: IntentDefinition): number {
        let score = 0;
        const normalizedInput = input.toLowerCase();

        // Check keyword matches
        const keywordMatches = intent.keywords.filter(keyword => 
            normalizedInput.includes(keyword.toLowerCase())
        );
        score += keywordMatches.length / intent.keywords.length;

        // Check pattern matches
        const patternMatches = intent.patterns.some(pattern => pattern.test(input));
        if (patternMatches) score += 0.5;

        // Check context relevance if applicable
        if (intent.contextKeywords && this.context) {
            const contextMatches = intent.contextKeywords.filter(keyword =>
                normalizedInput.includes(keyword.toLowerCase())
            );
            score += contextMatches.length * 0.2;
        }

        return score;
    }

    private extractMatches(input: string, intent: IntentDefinition): string[] {
        const matches: string[] = [];

        // Extract keyword matches
        intent.keywords.forEach(keyword => {
            const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
            const keywordMatches = input.match(regex);
            if (keywordMatches) {
                matches.push(...keywordMatches);
            }
        });

        // Extract pattern matches
        intent.patterns.forEach(pattern => {
            const patternMatches = input.match(pattern);
            if (patternMatches) {
                matches.push(...patternMatches.slice(1));
            }
        });

        return matches;
    }

    private extractParameters(input: string, intent: IntentDefinition): Record<string, any> {
        const params: Record<string, any> = {};

        switch (intent.action) {
            case 'SET_TEMPERATURE':
                const tempMatch = input.match(/(\d+)\s*(?:degrees?)?/i);
                if (tempMatch) {
                    params.temperature = parseInt(tempMatch[1]);
                }
                break;

            case 'SET_TIMER':
                const timerMatch = input.match(/(\d+)\s*(minute|hour)s?/i);
                if (timerMatch) {
                    const [_, amount, unit] = timerMatch;
                    params.duration = parseInt(amount);
                    params.unit = unit.toLowerCase();
                }
                break;

            case 'SET_VOLUME':
                const volumeMatch = input.match(/(\d+)(?:\s*%|\s*percent)?/i);
                if (volumeMatch) {
                    params.volume = parseInt(volumeMatch[1]);
                }
                break;
        }

        return params;
    }

    private updateContext(match: IntentMatch): void {
        this.context = {
            previousIntent: match.intent.type,
            timestamp: Date.now(),
            parameters: match.parameters
        };

        // Emit context update event
        this.emit('contextUpdate', this.context);
    }

    public getContext(): IntentContext | null {
        return this.context;
    }

    public clearContext(): void {
        this.context = null;
        this.emit('contextUpdate', null);
    }

    // Add new intent definitions programmatically
    public addIntent(action: IntentAction, definition: Omit<IntentDefinition, 'action'>): void {
        this.intents.set(action, { ...definition, action });
        logger.info('New intent added', { action });
    }

    // Remove intent definitions
    public removeIntent(action: IntentAction): void {
        this.intents.delete(action);
        logger.info('Intent removed', { action });
    }

    // Add proper return type overrides for emit and on
    emit<K extends keyof IntentHandlerEvents>(
        event: K,
        ...args: Parameters<IntentHandlerEvents[K]>
    ): boolean {
        return super.emit(event, ...args);
    }

    on<K extends keyof IntentHandlerEvents>(
        event: K,
        listener: IntentHandlerEvents[K]
    ): this {
        return super.on(event, listener);
    }

    private logIntentMatch(match: IntentMatch): void {
        logger.debug('Intent matched', {
            type: match.intent.type,
            action: match.intent.action,
            score: match.score,
            parameters: match.parameters
        });
    }

    private logNoMatch(input: string): void {
        logger.debug('No intent match found', { input });
    }
}

export interface Intent {
    type: IntentType;
    action: IntentAction;
    keywords: string[];
    patterns: RegExp[];
    contextKeywords?: string[];
    priority?: number;
    requiresContext?: boolean;
}

export interface IntentHandler {
    handleIntent(intent: Intent): Promise<void>;
    // ... rest of interface
}