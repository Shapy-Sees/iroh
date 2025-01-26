// src/controllers/phone-controller.ts
//
// Enhanced phone controller that manages DAHDI hardware interface and phone state.
// Key responsibilities:
// - Managing phone state transitions using FSM pattern
// - Processing DTMF and voice commands
// - Coordinating audio streaming with DAHDI format requirements
// - Hardware health monitoring and error recovery
// - Providing real-time phone status and diagnostics

import { EventEmitter } from 'events';
import { DAHDIInterface } from '../hardware/dahdi-interface';
import { DTMFDetector } from '../audio/dtmf-detector';
import { VoiceDetector } from '../audio/voice-detector';
import { AudioPipeline } from '../audio/pipeline';
import { IrohAIService } from '../services/ai/ai-service';
import { 
    AudioInput, 
    PhoneControllerConfig, 
    DTMFEvent, 
    VoiceEvent,
    DAHDIAudioFormat,
    AudioFormatError
} from '../types';
import { logger } from '../utils/logger';
import { ErrorHandler } from '../utils/error-handler';
import { PhoneFeedbackHandler } from './phone-feedback-handler';
import {
    EVENTS,
    ERROR_CODES,
    TIMEOUTS,
    DEFAULTS,
    DAHDI_ALARMS,
    DAHDI_COMMANDS
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
    private dahdi: DAHDIInterface;
    private dtmfDetector: DTMFDetector;
    private voiceDetector: VoiceDetector;
    private audioPipeline: AudioPipeline;
    private aiService: IrohAIService | null = null;
    private feedback: PhoneFeedback;
    private errorHandler: ErrorHandler;
    private currentState: PhoneState = PhoneState.IDLE;
    private commandBuffer: string[] = [];
    private lastCommandTime: number = 0;
    private isProcessingCommand: boolean = false;
    private alarmState: number = DAHDI_ALARMS.NONE;
    
    private readonly stateTransitions: Map<PhoneState, Set<PhoneState>>;
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

        // Initialize DAHDI interface
        this.dahdi = new DAHDIInterface({
            devicePath: config.fxs.devicePath,
            sampleRate: this.dahdiFormat.sampleRate,
            channels: this.dahdiFormat.channels,
            bitDepth: this.dahdiFormat.bitDepth,
            bufferSize: config.audio.bufferSize
        });

        // Initialize AI service if configured
        if (config.ai?.apiKey) {
            this.aiService = new IrohAIService(config.ai);
        }

        // Initialize feedback and error handling
        this.feedback = new PhoneFeedbackHandler(this.aiService!, this.dahdi);
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
        // Handle DAHDI hardware events
        this.dahdi.on(EVENTS.DAHDI.ALARM, (alarmType: number) => {
            this.handleAlarmState(alarmType);
        });

        // Handle hook state changes with debouncing
        let hookDebounceTimer: NodeJS.Timeout | null = null;
        const HOOK_DEBOUNCE_TIME = 100; // ms

        this.dahdi.on(EVENTS.PHONE.OFF_HOOK, () => {
            if (hookDebounceTimer) clearTimeout(hookDebounceTimer);
            hookDebounceTimer = setTimeout(() => this.handleOffHook(), HOOK_DEBOUNCE_TIME);
        });

        this.dahdi.on(EVENTS.PHONE.ON_HOOK, () => {
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

    private async handleAlarmState(alarmType: number): Promise<void> {
        this.alarmState = alarmType;
        logger.warn('DAHDI alarm state changed:', {
            alarmType,
            description: this.getAlarmDescription(alarmType)
        });

        if (alarmType & DAHDI_ALARMS.RED) {
            await this.setState(PhoneState.ERROR);
            await this.errorHandler.handleError(
                new Error('Lost signal on DAHDI device'),
                {
                    component: 'dahdi',
                    operation: 'signal',
                    severity: 'high'
                }
            );
        }

        if (alarmType & DAHDI_ALARMS.NOTOPEN) {
            await this.setState(PhoneState.ERROR);
            await this.errorHandler.handleError(
                new Error('DAHDI device not opened'),
                {
                    component: 'dahdi',
                    operation: 'device',
                    severity: 'critical'
                }
            );
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
        this.emit('stateChange', { oldState, newState });

        // Handle state-specific actions
        switch (newState) {
            case PhoneState.IDLE:
                this.commandBuffer = [];
                break;
            case PhoneState.ERROR:
                await this.feedback.error();
                break;
        }
    }

    private async handleOffHook(): Promise<void> {
        logger.info('Phone off hook detected');
        await this.setState(PhoneState.OFF_HOOK);
        this.commandBuffer = [];

        try {
            // Play dial tone through DAHDI
            await this.dahdi.generateTone({
                frequency: 350,
                duration: -1, // Continuous
                level: -10  // dBm0 level
            });

            // Play greeting if AI service is available
            if (this.aiService) {
                await this.feedback.playTonePattern([
                    { frequency: 350, duration: 200 },
                    { frequency: 440, duration: 200 }
                ]);
            }

            this.emit(EVENTS.PHONE.OFF_HOOK);
        } catch (error) {
            logger.error('Error handling off hook:', error);
            await this.handleHardwareError(error);
        }
    }

    private async handleOnHook(): Promise<void> {
        logger.info('Phone on hook detected');
        await this.setState(PhoneState.IDLE);
        this.commandBuffer = [];
        
        try {
            // Stop any ongoing audio
            await this.dahdi.stopTone();
            this.emit(EVENTS.PHONE.ON_HOOK);
        } catch (error) {
            logger.error('Error handling on hook:', error);
            await this.handleHardwareError(error);
        }
    }

    private async handleAudioData(audioInput: AudioInput): Promise<void> {
        if (this.currentState === PhoneState.ERROR) return;

        try {
            // Validate audio format
            if (!this.validateAudioFormat(audioInput)) {
                throw new AudioFormatError('Invalid audio format', [
                    'Audio format does not meet DAHDI requirements'
                ]);
            }

            // Process audio through pipeline
            await this.audioPipeline.processAudio(audioInput);

        } catch (error) {
            logger.error('Error processing audio data:', error);
            await this.errorHandler.handleError(error, {
                component: 'audio',
                operation: 'process'
            });
        }
    }

    private validateAudioFormat(input: AudioInput): boolean {
        return (
            input.sampleRate === this.dahdiFormat.sampleRate &&
            input.channels === this.dahdiFormat.channels &&
            input.bitDepth === this.dahdiFormat.bitDepth
        );
    }

    private async handleHardwareError(error: Error): Promise<void> {
        await this.setState(PhoneState.ERROR);
        
        try {
            // Attempt hardware recovery
            const diagnostics = await this.runDiagnostics();
            const recoverySuccessful = diagnostics.every(test => test.passed);

            if (recoverySuccessful && this.alarmState === DAHDI_ALARMS.NONE) {
                await this.setState(PhoneState.IDLE);
                logger.info('Hardware recovery successful');
                await this.feedback.acknowledge('recovery', 'success');
            } else {
                throw new Error('Hardware recovery failed');
            }
        } catch (recoveryError) {
            logger.error('Hardware recovery failed:', recoveryError);
            await this.errorHandler.handleError(recoveryError, {
                component: 'hardware',
                operation: 'recovery',
                severity: 'critical'
            });
        }
    }

    public async start(): Promise<void> {
        try {
            logger.info('Starting phone controller');
            
            // Initialize DAHDI interface
            await this.dahdi.start();
            
            // Initialize audio pipeline
            this.audioPipeline.addHandler('dtmf', 
                event => this.dtmfDetector.processBuffer(event.data)
            );
            this.audioPipeline.addHandler('voice',
                event => this.voiceDetector.analyze(event)
            );
            
            // Reset state
            await this.setState(PhoneState.IDLE);
            this.commandBuffer = [];
            this.lastCommandTime = 0;
            
            logger.info('Phone controller started successfully');
            this.emit(EVENTS.SYSTEM.READY);
        } catch (error) {
            logger.error('Failed to start phone controller:', error);
            throw error;
        }
    }

    public async playAudio(buffer: Buffer): Promise<void> {
        if (this.currentState === PhoneState.ERROR) {
            logger.warn('Cannot play audio - phone in error state');
            return;
        }

        try {
            await this.dahdi.playAudio(buffer, this.dahdiFormat);
            logger.debug('Played audio buffer', { bytes: buffer.length });
        } catch (error) {
            logger.error('Error playing audio:', error);
            await this.errorHandler.handleError(error, {
                component: 'audio',
                operation: 'playback'
            });
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

            await this.dahdi.generateTone(toneConfig);
            logger.debug('Played tone', { type });
        } catch (error) {
            logger.error('Error playing tone:', error);
            await this.errorHandler.handleError(error, {
                component: 'audio',
                operation: 'tone'
            });
        }
    }

    public async ring(duration: number = TIMEOUTS.RING): Promise<void> {
        if (this.currentState !== PhoneState.IDLE) {
            logger.warn('Cannot ring - phone not idle');
            return;
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
        } catch (error) {
            logger.error('Error initiating ring:', error);
            await this.handleHardwareError(error);
        }
    }

    private async handleDTMF(event: DTMFEvent): Promise<void> {
        if (this.currentState !== PhoneState.OFF_HOOK && 
            this.currentState !== PhoneState.IN_CALL) {
            return;
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
            this.emit(EVENTS.PHONE.DTMF, event);
        } catch (error) {
            logger.error('Error handling DTMF:', error);
            await this.errorHandler.handleError(error, {
                component: 'dtmf',
                operation: 'process'
            });
        }
    }

    private async handleVoice(event: VoiceEvent): Promise<void> {
        if (this.currentState !== PhoneState.IN_CALL) {
            return;
        }

        logger.debug('Voice detected', {
            duration: event.endTime - event.startTime,
            final: event.isFinal
        });

        try {
            if (this.aiService && event.isFinal) {
                // Convert speech to text
                const text = await this.aiService.processVoice(event.audio);
                
                // Process command
                const response = await this.aiService.processText(text);
                
                // Generate speech response
                const audio = await this.aiService.generateSpeech(response);
                
                // Play response
                await this.playAudio(audio);
            }

            // Emit voice event
            this.emit(EVENTS.PHONE.VOICE, event);
        } catch (error) {
            logger.error('Error handling voice:', error);
            await this.errorHandler.handleError(error, {
                component: 'voice',
                operation: 'process'
            });
        }
    }

    private async checkCommand(): Promise<void> {
        // Check if we have a complete command sequence
        if (this.commandBuffer.length >= 2 && 
            Date.now() - this.lastCommandTime > TIMEOUTS.COMMAND) {
            
            const command = this.commandBuffer.join('');
            this.commandBuffer = [];
            
            try {
                await this.executeCommand(command);
            } catch (error) {
                logger.error('Error executing command:', error);
                await this.errorHandler.handleError(error, {
                    component: 'command',
                    operation: 'execute',
                    command
                });
            }
        }
    }

    private async executeCommand(command: string): Promise<void> {
        if (this.isProcessingCommand) {
            logger.warn('Command already in progress, ignoring:', command);
            return;
        }

        this.isProcessingCommand = true;
        logger.info('Executing command:', command);

        try {
            // Execute command implementation
            await this.feedback.provideProgressFeedback(0.5);
            
            // Command success feedback
            await this.feedback.handleRecovery(true);
        } catch (error) {
            logger.error('Command execution failed:', error);
            await this.feedback.handleError(error, {
                component: 'command',
                operation: 'execute',
                command
            });
            throw error;
        } finally {
            this.isProcessingCommand = false;
        }
    }

    public async runDiagnostics(): Promise<Array<{
        test: string;
        passed: boolean;
        message?: string;
    }>> {
        logger.info('Running phone diagnostics');

        try {
            const results = [];

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

    private async testAudioPath(): Promise<{
        test: string;
        passed: boolean;
        message: string;
    }> {
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

    public getState(): PhoneState {
        return this.currentState;
    }

    public getAlarmState(): number {
        return this.alarmState;
    }

    public isOpen(): boolean {
        return this.dahdi.isOpen();
    }

    public getFXSInterface(): DAHDIInterface {
        return this.dahdi;
    }

    public async stop(): Promise<void> {
        try {
            logger.info('Stopping phone controller');
            
            // Stop all subsystems
            await this.dahdi.stop();
            this.dtmfDetector.shutdown();
            this.voiceDetector.shutdown();
            this.audioPipeline.shutdown();
            
            // Clear state
            await this.setState(PhoneState.IDLE);
            this.commandBuffer = [];
            
            // Remove all event listeners
            this.removeAllListeners();
            
            logger.info('Phone controller stopped successfully');
        } catch (error) {
            logger.error('Error stopping phone controller:', error);
            throw error;
        }
    }
}