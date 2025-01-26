// src/controllers/phone-controller.ts
//
// Enhanced phone controller that manages DAHDI hardware interface and phone state.
// Provides high-level control of the telephone system including:
// - Phone state management (hook state, ringing, etc)
// - Audio processing coordination
// - DTMF detection and handling
// - Voice command processing
// - Hardware monitoring and error recovery

import { EventEmitter } from 'events';
// Add interface definitions at the top
interface DiagnosticResult {
    test: string;
    passed: boolean;
    message?: string;
}

interface ToneOptions {
    frequency: number;
    duration: number;
    level: number;
}

import { DAHDIInterface } from '../hardware/dahdi-interface';
import { DTMFDetector } from '../audio/dtmf-detector';
import { VoiceDetector } from '../audio/voice-detector';
import { AudioPipeline } from '../audio/pipeline';
import { PhoneFeedbackHandler } from './phone-feedback-handler';
import { logger } from '../utils/logger';
import { ErrorHandler } from '../utils/error-handler';
import { DAHDIError } from '../types/hardware/dahdi';
import { AudioError } from '../types/hardware/audio';

import {
    AudioInput,
    PhoneControllerConfig,
    DTMFEvent,
    VoiceEvent,
    DAHDIAudioFormat,
    Result,
    HardwareError
} from '../types/hardware/dahdi';

// Phone states based on DAHDI hardware states
enum PhoneState {
    IDLE = 'idle',
    OFF_HOOK = 'off_hook',
    RINGING = 'ringing',
    IN_CALL = 'in_call',
    ERROR = 'error'
}

// Update class to extend correctly typed EventEmitter
export class PhoneController extends EventEmitter {
    // Add type declarations for events
    declare emit: {
        (event: 'stateChange', payload: { oldState: PhoneState; newState: PhoneState }): boolean;
        (event: 'off_hook'): boolean;
        (event: 'on_hook'): boolean;
        (event: 'dtmf', event: DTMFEvent): boolean;
        (event: 'voice', event: VoiceEvent): boolean;
    };

    private dahdi: DAHDIInterface;
    private dtmfDetector: DTMFDetector;
    private voiceDetector: VoiceDetector;
    private audioPipeline: AudioPipeline;
    private feedback: PhoneFeedbackHandler;
    private errorHandler: ErrorHandler;
    private currentState: PhoneState = PhoneState.IDLE;
    private commandBuffer: string[] = [];
    private lastCommandTime: number = 0;
    private isProcessingCommand: boolean = false;
    private readonly stateTransitions: Map<PhoneState, Set<PhoneState>>;

    // DAHDI format requirements
    private readonly dahdiFormat: DAHDIAudioFormat = {
        sampleRate: 8000,    // DAHDI requires 8kHz
        channels: 1,         // DAHDI is mono
        bitDepth: 16,        // DAHDI uses 16-bit PCM
        format: 'linear'     // Linear PCM format
    };

    constructor(config: PhoneControllerConfig) {
        super();
        logger.debug('Initializing phone controller', {
            config: this.sanitizeConfig(config)
        });

        // Initialize DAHDI interface with required 8kHz/mono/16-bit settings
        this.dahdi = new DAHDIInterface({
            devicePath: config.fxs.devicePath,
            sampleRate: this.dahdiFormat.sampleRate,
            channels: this.dahdiFormat.channels,
            bitDepth: this.dahdiFormat.bitDepth,
            bufferSize: config.audio.bufferSize
        });

        // Initialize audio processing components
        this.dtmfDetector = new DTMFDetector({
            sampleRate: this.dahdiFormat.sampleRate,
            minDuration: 40,  // 40ms minimum for DTMF detection
            bufferSize: config.audio.bufferSize
        });

        this.voiceDetector = new VoiceDetector({
            sampleRate: this.dahdiFormat.sampleRate,
            frameDuration: 20,
            vadThreshold: config.audio.vadThreshold || 0.3
        });

        this.audioPipeline = new AudioPipeline();

        // Initialize feedback and error handling
        this.feedback = new PhoneFeedbackHandler(this.dahdi);
        this.errorHandler = new ErrorHandler();

        // Initialize state transition map
        this.stateTransitions = this.initializeStateTransitions();

        // Set up event handlers
        this.setupEventHandlers();
    }

    private sanitizeConfig(config: PhoneControllerConfig): Partial<PhoneControllerConfig> {
        return {
            ...config,
            fxs: { ...config.fxs, devicePath: '***' },
            ai: config.ai ? { ...config.ai, apiKey: '***' } : undefined
        };
    }

    private initializeStateTransitions(): Map<PhoneState, Set<PhoneState>> {
        const transitions = new Map<PhoneState, Set<PhoneState>>();
        
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
        // Handle hook state changes with debouncing
        let hookDebounceTimer: NodeJS.Timeout | null = null;
        const HOOK_DEBOUNCE_TIME = 100; // ms

        this.dahdi.on('off_hook', () => {
            if (hookDebounceTimer) clearTimeout(hookDebounceTimer);
            hookDebounceTimer = setTimeout(() => this.handleOffHook(), HOOK_DEBOUNCE_TIME);
        });

        this.dahdi.on('on_hook', () => {
            if (hookDebounceTimer) clearTimeout(hookDebounceTimer);
            hookDebounceTimer = setTimeout(() => this.handleOnHook(), HOOK_DEBOUNCE_TIME);
        });

        // Handle audio events with error recovery
        this.dahdi.on('audio', async (data: AudioInput) => {
            try {
                await this.handleAudioData(data);
            } catch (error) {
                logger.error('Error handling audio data:', error);
                await this.errorHandler.handleError(error, {
                    component: 'audio',
                    operation: 'process'
                });
            }
        });

        // Handle DTMF events
        this.dtmfDetector.on('dtmf', async (event: DTMFEvent) => {
            try {
                await this.handleDTMF(event);
            } catch (error) {
                logger.error('Error handling DTMF:', error);
                await this.errorHandler.handleError(error, {
                    component: 'dtmf',
                    operation: 'process'
                });
            }
        });

        // Handle voice events
        this.voiceDetector.on('voice', async (event: VoiceEvent) => {
            try {
                await this.handleVoice(event);
            } catch (error) {
                logger.error('Error handling voice:', error);
                await this.errorHandler.handleError(error, {
                    component: 'voice',
                    operation: 'process'
                });
            }
        });
    }

    public async start(): Promise<Result<void>> {
        try {
            logger.info('Starting phone controller');
            
            // Initialize DAHDI interface
            await this.dahdi.start();
            
            // Initialize audio pipeline
            await this.audioPipeline.start();
            
            // Reset state
            await this.setState(PhoneState.IDLE);
            this.commandBuffer = [];
            this.lastCommandTime = 0;
            
            logger.info('Phone controller started successfully');
            
            return { success: true, data: undefined };
        } catch (error) {
            logger.error('Failed to start phone controller:', error);
            return { 
                success: false, 
                error: error instanceof Error ? error : new Error(String(error))
            };
        }
    }

    public async stop(): Promise<Result<void>> {
        try {
            logger.info('Stopping phone controller');
            
            // Stop all subsystems
            await this.dahdi.stop();
            await this.audioPipeline.shutdown();
            
            // Clear state
            await this.setState(PhoneState.IDLE);
            this.commandBuffer = [];
            
            // Remove all event listeners
            this.removeAllListeners();
            
            logger.info('Phone controller stopped successfully');
            
            return { success: true, data: undefined };
        } catch (error) {
            logger.error('Error stopping phone controller:', error);
            return { 
                success: false, 
                error: error instanceof Error ? error : new Error(String(error))
            };
        }
    }

    private async setState(newState: PhoneState): Promise<Result<void>> {
        // Validate state transition
        const allowedStates = this.stateTransitions.get(this.currentState);
        if (!allowedStates?.has(newState)) {
            logger.error(`Invalid state transition from ${this.currentState} to ${newState}`);
            return {
                success: false,
                error: new Error(`Invalid state transition: ${this.currentState} -> ${newState}`)
            };
        }

        const oldState = this.currentState;
        this.currentState = newState;
        
        logger.info('Phone state changed', {
            from: oldState,
            to: newState,
            timestamp: Date.now()
        });

        // Emit state change event
        this.emit('stateChange', { oldState, newState });

        // Handle state-specific actions
        try {
            switch (newState) {
                case PhoneState.IDLE:
                    this.commandBuffer = [];
                    break;
                case PhoneState.ERROR:
                    await this.feedback.error();
                    break;
            }
            return { success: true, data: undefined };
        } catch (error) {
            logger.error('Error during state change actions:', error);
            return {
                success: false,
                error: error instanceof Error ? error : new Error(String(error))
            };
        }
    }

    private async handleOffHook(): Promise<Result<void>> {
        logger.info('Phone off hook detected');
        
        try {
            await this.setState(PhoneState.OFF_HOOK);
            this.commandBuffer = [];

            // Play dial tone through DAHDI
            await this.dahdi.generateTone({
                frequency: 350,
                duration: -1, // Continuous
                level: -10  // dBm0 level
            });

            // Play ready feedback tone pattern
            await this.feedback.playTonePattern([
                { frequency: 350, duration: 200 },
                { frequency: 440, duration: 200 }
            ]);

            this.emit('off_hook');
            return { success: true, data: undefined };

        } catch (error) {
            logger.error('Error handling off hook:', error);
            await this.handleHardwareError(error);
            return {
                success: false,
                error: error instanceof Error ? error : new Error(String(error))
            };
        }
    }

    private async handleOnHook(): Promise<Result<void>> {
        logger.info('Phone on hook detected');
        
        try {
            await this.setState(PhoneState.IDLE);
            this.commandBuffer = [];
            
            // Stop any ongoing audio
            await this.dahdi.stopTone();
            this.emit('on_hook');
            
            return { success: true, data: undefined };
            
        } catch (error) {
            logger.error('Error handling on hook:', error);
            await this.handleHardwareError(error);
            return {
                success: false,
                error: error instanceof Error ? error : new Error(String(error))
            };
        }
    }

    private async handleAudioData(audioInput: AudioInput): Promise<Result<void>> {
        if (this.currentState === PhoneState.ERROR) {
            return { success: false, error: new Error('Phone in error state') };
        }

        try {
            // Validate audio format meets DAHDI requirements
            if (!this.validateAudioFormat(audioInput)) {
                throw new Error('Invalid audio format for DAHDI');
            }

            // Process audio through pipeline
            await this.audioPipeline.processAudio(audioInput);
            return { success: true, data: undefined };

        } catch (error) {
            logger.error('Error processing audio data:', error);
            await this.errorHandler.handleError(error, {
                component: 'audio',
                operation: 'process'
            });
            return {
                success: false,
                error: error instanceof Error ? error : new Error(String(error))
            };
        }
    }

    private validateAudioFormat(input: AudioInput): boolean {
        return (
            input.sampleRate === this.dahdiFormat.sampleRate &&
            input.channels === this.dahdiFormat.channels &&
            input.bitDepth === this.dahdiFormat.bitDepth
        );
    }

    private async handleHardwareError(error: Error): Promise<Result<void>> {
        await this.setState(PhoneState.ERROR);
        
        try {
            // Attempt hardware recovery
            const diagnostics = await this.runDiagnostics();
            const recoverySuccessful = diagnostics.every(test => test.passed);

            if (recoverySuccessful) {
                await this.setState(PhoneState.IDLE);
                logger.info('Hardware recovery successful');
                await this.feedback.acknowledge('recovery', 'success');
                return { success: true, data: undefined };
            } else {
                throw new HardwareError('Hardware recovery failed');
            }
        } catch (recoveryError) {
            logger.error('Hardware recovery failed:', recoveryError);
            await this.errorHandler.handleError(recoveryError, {
                component: 'hardware',
                operation: 'recovery',
                severity: 'critical'
            });
            return {
                success: false,
                error: recoveryError instanceof Error ? recoveryError : new Error(String(recoveryError))
            };
        }
    }

    public async playAudio(buffer: Buffer): Promise<Result<void>> {
        if (this.currentState === PhoneState.ERROR) {
            return {
                success: false,
                error: new Error('Cannot play audio - phone in error state')
            };
        }

        try {
            await this.dahdi.playAudio(buffer, this.dahdiFormat);
            logger.debug('Played audio buffer', { bytes: buffer.length });
            return { success: true, data: undefined };
        } catch (error) {
            logger.error('Error playing audio:', error);
            await this.errorHandler.handleError(error, {
                component: 'audio',
                operation: 'playback'
            });
            return {
                success: false,
                error: error instanceof Error ? error : new Error(String(error))
            };
        }
    }

    public async playTone(
        type: string,
        options?: { duration?: number; level?: number }
    ): Promise<Result<void>> {
        if (this.currentState === PhoneState.ERROR) {
            return {
                success: false,
                error: new Error('Cannot play tone - phone in error state')
            };
        }

        try {
            await this.dahdi.generateTone({
                frequency: type === 'dialtone' ? 350 : 440,
                duration: options?.duration || 200,
                level: options?.level || -10
            });
            logger.debug('Played tone', { type, options });
            return { success: true, data: undefined };
        } catch (error) {
            logger.error('Error playing tone:', error);
            await this.errorHandler.handleError(error, {
                component: 'audio',
                operation: 'tone'
            });
            return {
                success: false,
                error: error instanceof Error ? error : new Error(String(error))
            };
        }
    }

    public async ring(duration: number = 2000): Promise<Result<void>> {
        if (this.currentState !== PhoneState.IDLE) {
            return {
                success: false,
                error: new Error('Cannot ring - phone not idle')
            };
        }

        try {
            await this.setState(PhoneState.RINGING);
            await this.dahdi.ring(duration);
            logger.debug('Ring initiated', { duration });

            // Reset state after ring completes
            setTimeout(async () => {
                if (this.currentState === PhoneState.RINGING) {
                    await this.setState(PhoneState.IDLE);
                }
            }, duration);

            return { success: true, data: undefined };
            
        } catch (error) {
            logger.error('Error initiating ring:', error);
            await this.handleHardwareError(error);
            return {
                success: false,
                error: error instanceof Error ? error : new Error(String(error))
            };
        }
    }

    private async handleDTMF(event: DTMFEvent): Promise<Result<void>> {
        if (this.currentState !== PhoneState.OFF_HOOK && 
            this.currentState !== PhoneState.IN_CALL) {
            return { success: false, error: new Error('Invalid state for DTMF') };
        }

        logger.debug('DTMF detected', {
            digit: event.digit,
            duration: event.duration
        });

        try {
            // Add to command buffer
            this.commandBuffer.push(event.digit);
            this.lastCommandTime = Date.now();

            // Play feedback tone
            await this.playTone('dtmf');

            // Check for complete command
            await this.checkCommand();

            // Emit DTMF event
            this.emit('dtmf', event);
            
            return { success: true, data: undefined };
            
        } catch (error) {
            logger.error('Error handling DTMF:', error);
            await this.errorHandler.handleError(error, {
                component: 'dtmf',
                operation: 'process'
            });
            return {
                success: false,
                error: error instanceof Error ? error : new Error(String(error))
            };
        }
    }

    private async handleVoice(event: VoiceEvent): Promise<Result<void>> {
        if (this.currentState !== PhoneState.IN_CALL) {
            return { success: false, error: new Error('Invalid state for voice processing') };
        }

        logger.debug('Voice detected', {
            duration: event.endTime - event.startTime,
            isFinal: event.isFinal
        });

        try {
            // Emit voice event for processing by higher-level services
            this.emit('voice', event);
            return { success: true, data: undefined };
            
        } catch (error) {
            logger.error('Error handling voice:', error);
            await this.errorHandler.handleError(error, {
                component: 'voice',
                operation: 'process'
            });
            return {
                success: false,
                error: error instanceof Error ? error : new Error(String(error))
            };
        }
    }

    private async checkCommand(): Promise<Result<void>> {
        // Check if we have a complete command sequence
        if (this.commandBuffer.length >= 2 && 
            Date.now() - this.lastCommandTime > 1000) { // 1 second timeout
            
            const command = this.commandBuffer.join('');
            this.commandBuffer = [];
            
            try {
                return await this.executeCommand(command);
            } catch (error) {
                logger.error('Error executing command:', error);
                await this.errorHandler.handleError(error, {
                    component: 'command',
                    operation: 'execute',
                    command
                });
                return {
                    success: false,
                    error: error instanceof Error ? error : new Error(String(error))
                };
            }
        }
        return { success: true, data: undefined };
    }

    private async executeCommand(command: string): Promise<Result<void>> {
        if (this.isProcessingCommand) {
            logger.warn('Command already in progress, ignoring:', command);
            return {
                success: false,
                error: new Error('Command already in progress')
            };
        }

        this.isProcessingCommand = true;
        logger.info('Executing command:', command);

        try {
            // Execute command implementation
            await this.feedback.provideProgressFeedback(0.5);
            
            // Command success feedback
            await this.feedback.handleRecovery(true);
            
            return { success: true, data: undefined };
            
        } catch (error) {
            logger.error('Command execution failed:', error);
            await this.feedback.handleError(error, {
                component: 'command',
                operation: 'execute',
                command
            });
            return {
                success: false,
                error: error instanceof Error ? error : new Error(String(error))
            };
        } finally {
            this.isProcessingCommand = false;
        }
    }

    public async runDiagnostics(): Promise<DiagnosticResult[]> {
        logger.info('Running phone diagnostics');

        try {
            const results: DiagnosticResult[] = [];

            // Test DAHDI status
            results.push({
                test: 'DAHDI Interface',
                passed: this.dahdi.isOpen(),
                message: this.dahdi.isOpen() ? 
                    'DAHDI interface active' : 
                    'DAHDI interface inactive'
            });

            // Test audio path
            const audioTest = await this.testAudioPath();
            results.push(audioTest);

            // Test DTMF detection
            results.push({
                test: 'DTMF Detection',
                passed: Boolean(this.dtmfDetector),
                message: 'DTMF detector initialized'
            });

            return results;
        } catch (error) {
            logger.error('Diagnostics failed:', error);
            throw error;
        }
    }

    private async testAudioPath(): Promise<DiagnosticResult> {
        try {
            // Generate and play test tone
            await this.playTone('test');
            return {
                test: 'Audio Path',
                passed: true,
                message: 'Audio path test successful'
            };
        } catch (error) {
            return {
                test: 'Audio Path',
                passed: false,
                message: `Audio path test failed: ${error instanceof Error ? 
                    error.message : String(error)}`
            };
        }
    }

    // Public getters for state and status
    public getState(): PhoneState {
        return this.currentState;
    }

    public isOpen(): boolean {
        return this.dahdi.isOpen();
    }

    public getFXSInterface(): DAHDIInterface {
        return this.dahdi;
    }
}