// src/controllers/phone-controller.ts
//
// Phone controller that manages DAHDI hardware interface and phone state.
// This controller is responsible for:
// - Managing phone state transitions
// - Processing DTMF and voice commands
// - Coordinating audio streaming
// - Handling hardware events and errors
// - Providing real-time phone status

import { EventEmitter } from 'events';
import { HardwareService } from '../services/hardware/hardware-service';
import { DTMFDetector } from '../audio/dtmf-detector';
import { AIService } from '../services/ai/ai-service';
import { AudioInput, PhoneControllerConfig, DTMFEvent, VoiceEvent } from '../types';
import { logger } from '../utils/logger';
import { 
    EVENTS,
    ERROR_CODES,
    TIMEOUTS,
    DEFAULTS,
    DAHDI_ALARMS 
} from '../core/constants';

// Phone states based on DAHDI hardware states
enum PhoneState {
    IDLE = 'idle',
    OFF_HOOK = 'off_hook',
    RINGING = 'ringing',
    IN_CALL = 'in_call',
    ERROR = 'error'
}

export class PhoneController extends EventEmitter {
    private hardware: HardwareService;
    private dtmfDetector: DTMFDetector;
    private aiService: AIService | null = null;
    private currentState: PhoneState = PhoneState.IDLE;
    private commandBuffer: string[] = [];
    private lastCommandTime: number = 0;
    private isProcessingCommand: boolean = false;
    private alarmState: number = DAHDI_ALARMS.NONE;
    private readonly stateTransitions: Map<PhoneState, Set<PhoneState>>;
    private eventHandlers: Map<string, Set<Function>>;
    
    private readonly config: Required<PhoneControllerConfig> = {
        fxs: {
            devicePath: DEFAULTS.DAHDI.DEVICE_PATH,
            sampleRate: DEFAULTS.AUDIO.SAMPLE_RATE,
            channels: DEFAULTS.AUDIO.CHANNELS,
            bitDepth: DEFAULTS.AUDIO.BIT_DEPTH
        },
        audio: {
            bufferSize: DEFAULTS.AUDIO.BUFFER_SIZE,
            channels: DEFAULTS.AUDIO.CHANNELS,
            bitDepth: DEFAULTS.AUDIO.BIT_DEPTH,
        },
        ai: {},
        dtmf: {
            minDuration: TIMEOUTS.DTMF,
            threshold: 0.25
        }
    };

    constructor(config: Partial<PhoneControllerConfig>) {
        super();
        
        // Initialize state transition map
        this.stateTransitions = this.initializeStateTransitions();
        
        // Initialize event handler map
        this.eventHandlers = new Map();
        
        // Merge provided config with defaults
        this.config = {
            ...this.config,
            ...config,
            fxs: { ...this.config.fxs, ...config.fxs },
            audio: { ...this.config.audio, ...config.audio },
            ai: { ...this.config.ai, ...config.ai }
        };

        logger.debug('Initializing phone controller', {
            config: this.sanitizeConfig(this.config)
        });

        // Initialize hardware service
        this.hardware = new HardwareService({
            devicePath: this.config.fxs.devicePath,
            sampleRate: this.config.fxs.sampleRate,
            channels: this.config.audio.channels,
            bitDepth: this.config.audio.bitDepth,
            bufferSize: this.config.audio.bufferSize
        });
        
        // Initialize DTMF detector with DAHDI settings
        this.dtmfDetector = new DTMFDetector({
            sampleRate: this.config.fxs.sampleRate,
            minDuration: this.config.dtmf.minDuration,
            threshold: this.config.dtmf.threshold,
            bufferSize: this.config.audio.bufferSize
        });

        // Initialize AI service if configured
        if (config.ai?.apiKey) {
            this.aiService = new AIService(config.ai);
        }
        
        // Set up event handlers
        this.setupEventHandlers();
    }

    private initializeStateTransitions(): Map<PhoneState, Set<PhoneState>> {
        const transitions = new Map<PhoneState, Set<PhoneState>>();
        
        // Define valid state transitions
        transitions.set(PhoneState.IDLE, new Set([
            PhoneState.OFF_HOOK,
            PhoneState.RINGING,
            PhoneState.ERROR
        ]));
        
        transitions.set(PhoneState.OFF_HOOK, new Set([
            PhoneState.IDLE,
            PhoneState.IN_CALL,
            PhoneState.ERROR
        ]));
        
        transitions.set(PhoneState.RINGING, new Set([
            PhoneState.IDLE,
            PhoneState.OFF_HOOK,
            PhoneState.ERROR
        ]));
        
        transitions.set(PhoneState.IN_CALL, new Set([
            PhoneState.IDLE,
            PhoneState.OFF_HOOK,
            PhoneState.ERROR
        ]));
        
        transitions.set(PhoneState.ERROR, new Set([
            PhoneState.IDLE
        ]));
        
        return transitions;
    }

    private setupEventHandlers(): void {
        // Handle DAHDI hardware events
        this.hardware.on(EVENTS.DAHDI.ALARM, (alarmType: number) => {
            this.handleAlarmState(alarmType);
        });

        this.hardware.on(EVENTS.PHONE.RING_START, () => {
            this.handleRingStart();
        });

        this.hardware.on(EVENTS.PHONE.RING_STOP, () => {
            this.handleRingStop();
        });

        // Handle hook state changes with debouncing
        let hookDebounceTimer: NodeJS.Timeout | null = null;
        const HOOK_DEBOUNCE_TIME = 100; // ms

        this.hardware.on(EVENTS.PHONE.OFF_HOOK, () => {
            if (hookDebounceTimer) {
                clearTimeout(hookDebounceTimer);
            }
            hookDebounceTimer = setTimeout(() => {
                this.handleOffHook();
            }, HOOK_DEBOUNCE_TIME);
        });

        this.hardware.on(EVENTS.PHONE.ON_HOOK, () => {
            if (hookDebounceTimer) {
                clearTimeout(hookDebounceTimer);
            }
            hookDebounceTimer = setTimeout(() => {
                this.handleOnHook();
            }, HOOK_DEBOUNCE_TIME);
        });

        // Handle audio events with error recovery
        this.hardware.on('audio', async (data: AudioInput) => {
            try {
                await this.handleAudioData(data);
            } catch (error) {
                logger.error('Error handling audio data:', error);
                this.emitError(ERROR_CODES.HARDWARE.AUDIO_ERROR, error);
            }
        });

        // Handle hardware errors with recovery attempts
        this.hardware.on(EVENTS.SYSTEM.ERROR, async (error: Error) => {
            logger.error('Hardware error:', error);
            await this.handleHardwareError(error);
        });

        // Handle DTMF events with validation
        this.dtmfDetector.on('dtmf', (event: DTMFEvent) => {
            if (this.validateDTMF(event)) {
                this.handleDTMF(event).catch(error => {
                    logger.error('Error handling DTMF:', error);
                    this.emitError(ERROR_CODES.HARDWARE.DTMF_ERROR, error);
                });
            }
        });
    }

    public on(event: string, handler: Function): this {
        // Add to our custom event handler map
        const handlers = this.eventHandlers.get(event) || new Set();
        handlers.add(handler);
        this.eventHandlers.set(event, handlers);
        
        // Also register with EventEmitter
        super.on(event, handler as any);
        return this;
    }

    public off(event: string, handler: Function): this {
        // Remove from our custom event handler map
        const handlers = this.eventHandlers.get(event);
        if (handlers) {
            handlers.delete(handler);
            if (handlers.size === 0) {
                this.eventHandlers.delete(event);
            }
        }
        
        // Also remove from EventEmitter
        super.off(event, handler as any);
        return this;
    }

    private async emitEvent(event: string, data?: any): Promise<void> {
        // Get handlers for this event
        const handlers = this.eventHandlers.get(event);
        if (handlers) {
            // Execute all handlers
            const promises = Array.from(handlers).map(handler => {
                try {
                    return Promise.resolve(handler(data));
                } catch (error) {
                    logger.error(`Error in event handler for ${event}:`, error);
                    return Promise.reject(error);
                }
            });
            
            // Wait for all handlers to complete
            await Promise.allSettled(promises);
        }
        
        // Emit through EventEmitter
        this.emit(event, data);
    }

    private emitError(code: string, error: Error): void {
        const errorEvent = {
            code,
            error,
            timestamp: Date.now()
        };
        this.emit(EVENTS.SYSTEM.ERROR, errorEvent);
    }

    private async setState(newState: PhoneState): Promise<void> {
        // Validate state transition
        const allowedStates = this.stateTransitions.get(this.currentState);
        if (!allowedStates?.has(newState)) {
            logger.error(`Invalid state transition from ${this.currentState} to ${newState}`);
            return;
        }

        const oldState = this.currentState;
        this.currentState = newState;
        
        logger.info('Phone state changed', {
            from: oldState,
            to: newState,
            timestamp: Date.now()
        });

        // Emit state change event
        await this.emitEvent('stateChange', { oldState, newState });
    }

    private handleAlarmState(alarmType: number): void {
        this.alarmState = alarmType;
        logger.warn('DAHDI alarm state changed:', {
            alarmType,
            description: this.getAlarmDescription(alarmType)
        });

        // Handle specific alarm conditions
        if (alarmType & DAHDI_ALARMS.RED) {
            this.setState(PhoneState.ERROR);
            this.emit(EVENTS.SYSTEM.ERROR, {
                code: ERROR_CODES.HARDWARE.DAHDI_SYNC_ERROR,
                message: 'Lost signal on DAHDI device'
            });
        }

        if (alarmType & DAHDI_ALARMS.NOTOPEN) {
            this.setState(PhoneState.ERROR);
            this.emit(EVENTS.SYSTEM.ERROR, {
                code: ERROR_CODES.HARDWARE.DAHDI_DEVICE_NOT_FOUND,
                message: 'DAHDI device not opened'
            });
        }
    }

    private getAlarmDescription(alarmType: number): string {
        const alarms: string[] = [];
        if (alarmType & DAHDI_ALARMS.RED) alarms.push('RED_ALARM');
        if (alarmType & DAHDI_ALARMS.YELLOW) alarms.push('YELLOW_ALARM');
        if (alarmType & DAHDI_ALARMS.BLUE) alarms.push('BLUE_ALARM');
        if (alarmType & DAHDI_ALARMS.NOTOPEN) alarms.push('DEVICE_NOT_OPEN');
        if (alarmType & DAHDI_ALARMS.RESET) alarms.push('NEEDS_RESET');
        if (alarmType & DAHDI_ALARMS.LOOPBACK) alarms.push('IN_LOOPBACK');
        if (alarmType & DAHDI_ALARMS.RECOVERING) alarms.push('RECOVERING');
        return alarms.join(', ') || 'NO_ALARM';
    }

    private setState(newState: PhoneState): void {
        const oldState = this.currentState;
        this.currentState = newState;
        
        logger.info('Phone state changed', {
            from: oldState,
            to: newState
        });

        this.emit('stateChange', { oldState, newState });
    }

    private async handleOffHook(): Promise<void> {
        logger.info('Phone off hook detected');
        this.setState(PhoneState.OFF_HOOK);
        this.commandBuffer = [];

        try {
            // Play dial tone
            await this.playTone('dial');
            this.emit(EVENTS.PHONE.OFF_HOOK);
        } catch (error) {
            logger.error('Error handling off hook:', error);
            await this.handleHardwareError(error);
        }
    }

    private async handleOnHook(): Promise<void> {
        logger.info('Phone on hook detected');
        this.setState(PhoneState.IDLE);
        this.commandBuffer = [];
        this.emit(EVENTS.PHONE.ON_HOOK);
    }

    private async handleAudioData(audioInput: AudioInput): Promise<void> {
        if (this.currentState === PhoneState.ERROR) return;

        try {
            // Process for DTMF first
            const dtmfResult = await this.dtmfDetector.analyze(audioInput);
            if (dtmfResult) {
                logger.debug('DTMF detected in audio stream', {
                    digit: dtmfResult.digit,
                    duration: dtmfResult.duration
                });
                return;
            }

            // If in call state, emit audio for further processing
            if (this.currentState === PhoneState.IN_CALL) {
                this.emit('audio', audioInput);
            }
        } catch (error) {
            logger.error('Error processing audio data:', error);
            this.emit(EVENTS.SYSTEM.ERROR, {
                code: ERROR_CODES.HARDWARE.AUDIO_ERROR,
                error
            });
        }
    }

    private async handleHardwareError(error: Error): Promise<void> {
        this.setState(PhoneState.ERROR);
        
        try {
            // Attempt hardware recovery
            await this.hardware.runDiagnostics();
            
            // If successful, restore previous state
            if (this.alarmState === DAHDI_ALARMS.NONE) {
                this.setState(PhoneState.IDLE);
                logger.info('Hardware recovery successful');
            } else {
                throw new Error('Hardware still in alarm state');
            }
        } catch (recoveryError) {
            logger.error('Hardware recovery failed:', recoveryError);
            this.emit(EVENTS.SYSTEM.ERROR, {
                code: ERROR_CODES.HARDWARE.DAHDI_DEVICE_ERROR,
                error: recoveryError
            });
        }
    }

    public async start(): Promise<void> {
        try {
            logger.info('Starting phone controller');
            
            // Initialize hardware service
            await this.hardware.initialize();
            
            // Reset state
            this.setState(PhoneState.IDLE);
            this.commandBuffer = [];
            this.lastCommandTime = 0;
            
            this.emit(EVENTS.SYSTEM.READY);
            logger.info('Phone controller started successfully');
        } catch (error) {
            logger.error('Failed to start phone controller:', error);
            throw error;
        }
    }

    public async playTone(type: string): Promise<void> {
        if (this.currentState === PhoneState.ERROR) {
            logger.warn('Cannot play tone - phone in error state');
            return;
        }

        try {
            // Get tone configuration from constants
            const toneConfig = DEFAULTS.DAHDI.TONES?.[type];
            if (!toneConfig) {
                throw new Error(`Unknown tone type: ${type}`);
            }

            await this.hardware.playTone(toneConfig);
            logger.debug('Played tone', { type });
        } catch (error) {
            logger.error('Error playing tone:', error);
            throw error;
        }
    }

    public async playAudio(buffer: Buffer): Promise<void> {
        if (this.currentState === PhoneState.ERROR) {
            logger.warn('Cannot play audio - phone in error state');
            return;
        }

        try {
            await this.hardware.playAudio(buffer);
            logger.debug('Played audio buffer', { bytes: buffer.length });
        } catch (error) {
            logger.error('Error playing audio:', error);
            throw error;
        }
    }

    public async ring(duration: number = TIMEOUTS.RING): Promise<void> {
        if (this.currentState !== PhoneState.IDLE) {
            logger.warn('Cannot ring - phone not idle');
            return;
        }

        try {
            await this.hardware.ring(duration);
            logger.debug('Ring initiated', { duration });
        } catch (error) {
            logger.error('Error initiating ring:', error);
            throw error;
        }
    }

    public getState(): PhoneState {
        return this.currentState;
    }

    public getAlarmState(): number {
        return this.alarmState;
    }

    public async runDiagnostics(): Promise<any> {
        return await this.hardware.runDiagnostics();
    }

    public async stop(): Promise<void> {
        try {
            logger.info('Stopping phone controller');
            
            // Stop all subsystems
            await this.hardware.shutdown();
            this.dtmfDetector.shutdown();
            
            // Clear state
            this.setState(PhoneState.IDLE);
            this.commandBuffer = [];
            this.removeAllListeners();
            
            logger.info('Phone controller stopped successfully');
        } catch (error) {
            logger.error('Error stopping phone controller:', error);
            throw error;
        }
    }
}