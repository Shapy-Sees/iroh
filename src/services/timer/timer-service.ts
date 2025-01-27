// src/services/timer/timer-service.ts
//
// Timer service that manages countdown timers through DAHDI
// Instead of using serial port communication, this version integrates
// with the DAHDI hardware interface directly for timing and notification

import { EventEmitter } from 'events';
import { PhoneController } from '../../controllers/phone-controller';
import { IrohAIService } from '../ai/ai-service';
import { logger } from '../../utils/logger';
import { Service, ServiceStatus, ServiceState } from '../../types/services';

interface TimerConfig {
    maxTimers: number;   // Maximum concurrent timers 
    maxDuration: number; // Max duration in minutes
}

interface Timer {
    id: string;
    duration: number;    // Duration in milliseconds
    startTime: number;   // Unix timestamp
    remaining: number;   // Remaining time in ms
    completed: boolean;
    endTime?: Date;      // Human readable end time
}

export class TimerService extends EventEmitter implements Service {
    private timers: Map<string, Timer>;
    private checkInterval: NodeJS.Timeout | null = null;
    private readonly config: Required<TimerConfig>;
    private serviceStatus: ServiceStatus;

    constructor(
        config: Partial<TimerConfig>,
        private phone: PhoneController,
        private ai: IrohAIService
    ) {
        super();
        this.serviceStatus = {
            state: 'initializing',
            isHealthy: false,
            lastUpdate: new Date()
        };
        
        // Set config with defaults
        this.config = {
            maxTimers: 5,
            maxDuration: 180, // 3 hours max
            ...config
        };

        this.timers = new Map();
        
        // Setup event handlers
        this.setupVoiceCommands();
        
        logger.info('Timer service constructed', { 
            maxTimers: this.config.maxTimers,
            maxDuration: this.config.maxDuration 
        });
    }

    public async initialize(): Promise<void> {
        try {
            await this.start();
            this.serviceStatus.state = 'ready';
            this.serviceStatus.isHealthy = true;
            this.serviceStatus.lastUpdate = new Date();
        } catch (error) {
            this.serviceStatus.state = 'error';
            this.serviceStatus.isHealthy = false;
            this.serviceStatus.lastError = error instanceof Error ? error : new Error(String(error));
            this.serviceStatus.lastUpdate = new Date();
            throw error;
        }
    }

    public async shutdown(): Promise<void> {
        try {
            await this.stop();
            this.serviceStatus.state = 'shutdown';
            this.serviceStatus.isHealthy = false;
            this.serviceStatus.lastUpdate = new Date();
        } catch (error) {
            this.serviceStatus.lastError = error instanceof Error ? error : new Error(String(error));
            throw error;
        }
    }

    public getStatus(): ServiceStatus {
        return this.serviceStatus;
    }

    public isHealthy(): boolean {
        return this.serviceStatus.isHealthy;
    }

    private setupVoiceCommands(): void {
        // Listen for voice commands
        this.phone.on('voice', async (audioBuffer: Buffer) => {
            try {
                // Convert speech to text
                const text = await this.ai.processVoice(audioBuffer);
                logger.debug('Processing voice command for timer', { text });
                
                // Check for timer command
                const timerDuration = this.parseTimerCommand(text);
                if (timerDuration) {
                    const timerId = await this.setTimer(timerDuration);
                    const timer = this.getTimer(timerId);
                    
                    if (timer) {
                        // Provide verbal confirmation
                        const confirmationMsg = this.generateConfirmationMessage(timer);
                        const speech = await this.ai.generateSpeech(confirmationMsg);
                        await this.phone.playAudio(speech);
                    }
                }
            } catch (error) {
                logger.error('Error processing voice command for timer:', error);
                const errorMsg = await this.ai.generateSpeech(
                    "I apologize, but I'm having trouble setting the timer. Could you try again?"
                );
                await this.phone.playAudio(errorMsg);
            }
        });
    }

    private parseTimerCommand(text: string): number | null {
        // Regular expressions for common timer phrases
        const patterns = [
            /set (?:a )?timer for (\d+) (minute|minutes|hour|hours)/i,
            /timer (?:for )?(\d+) (minute|minutes|hour|hours)/i,
            /remind me in (\d+) (minute|minutes|hour|hours)/i
        ];

        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match) {
                const [_, amount, unit] = match;
                const value = parseInt(amount);
                
                // Convert to minutes
                if (unit.toLowerCase().startsWith('hour')) {
                    return value * 60;
                }
                return value;
            }
        }

        return null;
    }

    private generateConfirmationMessage(timer: Timer): string {
        const endTime = timer.endTime;
        if (!endTime) return "Timer set.";

        const hours = endTime.getHours();
        const minutes = endTime.getMinutes();
        const period = hours >= 12 ? 'PM' : 'AM';
        const formattedHours = hours % 12 || 12;
        const formattedMinutes = minutes.toString().padStart(2, '0');

        return `Timer set. I'll remind you at ${formattedHours}:${formattedMinutes} ${period}.`;
    }

    public async setTimer(duration: number): Promise<string> {
        // Validate duration
        if (duration <= 0 || duration > this.config.maxDuration) {
            throw new Error(`Timer duration must be between 1 minute and ${this.config.maxDuration} minutes`);
        }

        // Check concurrent timer limit
        if (this.timers.size >= this.config.maxTimers) {
            throw new Error('Maximum number of concurrent timers reached');
        }

        // Create new timer
        const id = Math.random().toString(36).substr(2, 9);
        const now = Date.now();
        const timer: Timer = {
            id,
            duration: duration * 60 * 1000, // Convert to milliseconds
            startTime: now,
            remaining: duration * 60 * 1000,
            completed: false,
            endTime: new Date(now + (duration * 60 * 1000))
        };

        this.timers.set(id, timer);
        logger.info('Timer set', { id, duration });
        return id;
    }

    private async handleTimerComplete(timerId: string): Promise<void> {
        const timer = this.timers.get(timerId);
        if (!timer || timer.completed) {
            return;
        }

        timer.completed = true;
        this.emit('timerComplete', timerId);

        try {
            // Ring the phone through DAHDI
            await this.phone.playTone('busy');
            
            // Play timer completion message when answered
            this.phone.once('off_hook', async () => {
                await this.phone.playTone('confirm');
                const speech = await this.ai.generateSpeech("Your timer has completed.");
                await this.phone.playAudio(speech);
            });

            logger.info('Timer completed', { timerId });
        } catch (error) {
            logger.error('Error handling timer completion:', error);
        }
    }

    public async start(): Promise<void> {
        try {
            // Start timer check interval
            this.checkInterval = setInterval(() => {
                this.checkTimers();
            }, 1000);

            logger.info('Timer service started');
        } catch (error) {
            logger.error('Failed to start timer service:', error);
            throw error;
        }
    }

    private checkTimers(): void {
        const now = Date.now();
        
        for (const [id, timer] of this.timers.entries()) {
            if (timer.completed) {
                continue;
            }

            timer.remaining = timer.duration - (now - timer.startTime);

            if (timer.remaining <= 0) {
                this.handleTimerComplete(id).catch((error) => {
                    logger.error('Error checking timer:', error);
                });
            }
        }
    }

    public getTimer(id: string): Timer | null {
        return this.timers.get(id) || null;
    }

    public async stop(): Promise<void> {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }

        // Cancel all timers
        for (const [id] of this.timers) {
            await this.cancelTimer(id).catch(error => {
                logger.error('Error cancelling timer during shutdown:', error);
            });
        }

        logger.info('Timer service stopped');
    }

    public async cancelTimer(id: string): Promise<void> {
        const timer = this.timers.get(id);
        if (!timer) {
            throw new Error('Timer not found');
        }

        this.timers.delete(id);
        this.emit('timerCancelled', id);
        
        logger.info('Timer cancelled', { id });
    }
}