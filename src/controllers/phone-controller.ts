// src/controllers/phone-controller.ts
//
// Phone controller that manages DAHDI hardware interface and phone state.
// Provides high-level control of the telephony system including:
// - DTMF detection and command processing
// - Audio streaming and playback
// - Phone state management (hook state, ringing)
// - Event handling and error recovery
// - Hardware feedback and diagnostics

import { EventEmitter } from 'events';
import { HardwareService } from '../services/hardware/hardware-service';
import { DTMFDetector } from '../audio/dtmf-detector';
import { AIService } from '../services/ai/ai-service';
import { AudioInput, PhoneControllerConfig } from '../types';
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
    private aiService: AIService;
    private currentState: PhoneState = PhoneState.IDLE;
    private commandBuffer: string[] = [];
    private lastCommandTime: number = 0;
    private isProcessingCommand: boolean = false;
    private alarmState: number = DAHDI_ALARMS.NONE;
    
    // Initialize configuration from constants
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
        ai: {}
    };

    constructor(config: Partial<PhoneControllerConfig>) {
        super();
        
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
            sampleRate: DEFAULTS.AUDIO.SAMPLE_RATE,
            minDuration: TIMEOUTS.DTMF,
            bufferSize: DEFAULTS.AUDIO.BUFFER_SIZE
        });

        // Initialize AI service if configured
        if (config.ai?.anthropicKey) {
            this.aiService = new AIService(config.ai);
        }
        
        // Set up event handlers
        this.setupEventHandlers();
    }

    private sanitizeConfig(config: any): any {
        const sanitized = { ...config };
        if (sanitized.ai?.anthropicKey) sanitized.ai.anthropicKey = '***';
        return sanitized;
    }

    private setupEventHandlers(): void {
        // Handle DAHDI hardware events
        this.hardware.on(EVENTS.DAHDI.ALARM, (alarmType: number) => {
            this.handleAlarmState(alarmType);
        });

        this.hardware.on(EVENTS.PHONE.RING_START, () => {
            this.setState(PhoneState.RINGING);
            this.emit(EVENTS.PHONE.RING_START);
        });

        this.hardware.on(EVENTS.PHONE.RING_STOP, () => {
            if (this.currentState === PhoneState.RINGING) {
                this.setState(PhoneState.IDLE);
            }
            this.emit(EVENTS.PHONE.RING_STOP);
        });

        // Handle hook state changes
        this.hardware.on(EVENTS.PHONE.OFF_HOOK, () => {
            this.handleOffHook();
        });

        this.hardware.on(EVENTS.PHONE.ON_HOOK, () => {
            this.handleOnHook();
        });

        // Handle audio events
        this.hardware.on('audio', (data: AudioInput) => {
            this.handleAudioData(data).catch(error => {
                logger.error('Error handling audio data:', error);
            });
        });

        // Handle hardware errors
        this.hardware.on(EVENTS.SYSTEM.ERROR, (error: Error) => {
            logger.error('Hardware error:', error);
            this.setState(PhoneState.ERROR);
            this.emit(EVENTS.SYSTEM.ERROR, {
                code: ERROR_CODES.HARDWARE.DAHDI_DEVICE_ERROR,
                error
            });
        });

        // Handle DTMF events
        this.dtmfDetector.on('dtmf', (event) => {
            this.handleDTMF(event).catch(error => {
                logger.error('Error handling DTMF:', error);
            });
        });
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