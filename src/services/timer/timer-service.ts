// src/services/timer/timer-service.ts
//
// A service that manages countdown timers and coordinates 
// between hardware device notifications and phone ringing

import { EventEmitter } from 'events';
import { SerialPort } from 'serialport';
import { PhoneController } from '../../controllers/phone-controller';
import { AIService } from '../ai/ai-service';
import { logger } from '../../utils/logger';

interface TimerConfig {
    devicePath: string;  // Serial port config for hardware device
    baudRate: number;
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

export class TimerService extends EventEmitter {
    private timers: Map<string, Timer>;
    private serialPort: SerialPort;
    private phoneController: PhoneController;
    private aiService: AIService;
    private checkInterval: NodeJS.Timeout | null = null;
    private readonly config: Required<TimerConfig>;

    constructor(config: Partial<TimerConfig>, phoneController: PhoneController, aiService: AIService) {
        super();
        
        // Set default configuration
        this.config = {
            devicePath: '/dev/ttyUSB1',
            baudRate: 9600,
            maxTimers: 5,
            maxDuration: 180, // 3 hours max
            ...config
        };

        this.timers = new Map();
        this.phoneController = phoneController;
        this.aiService = aiService;
        
        this.serialPort = new SerialPort({
            path: this.config.devicePath,
            baudRate: this.config.baudRate,
            autoOpen: false
        });

        this.setupSerialPort();
        this.setupVoiceCommands();
    }

    private setupSerialPort(): void {
        this.serialPort.on('open', () => {
            logger.info('Timer hardware connection established');
        });

        this.serialPort.on('error', (error) => {
            logger.error('Timer hardware error:', error);
            this.emit('error', error);
        });

        // Handle responses from hardware
        this.serialPort.on('data', (data) => {
            try {
                const message = data.toString().trim();
                if (message.startsWith('TIMER_COMPLETE:')) {
                    const timerId = message.split(':')[1];
                    this.handleTimerComplete(timerId);
                }
            } catch (error) {
                logger.error('Error processing hardware message:', error);
            }
        });
    }

    private setupVoiceCommands(): void {
        // Listen for voice commands
        this.phoneController.on('voice', async (audioBuffer: Buffer) => {
            try {
                // Convert speech to text
                const text = await this.aiService.processVoice(audioBuffer);
                
                // Check for timer command
                const timerDuration = this.parseTimerCommand(text);
                if (timerDuration) {
                    const timerId = await this.setTimer(timerDuration);
                    const timer = this.getTimer(timerId);
                    
                    if (timer) {
                        // Provide verbal confirmation
                        const confirmationMsg = this.generateConfirmationMessage(timer);
                        const speech = await this.aiService.generateSpeech(confirmationMsg);
                        await this.phoneController.playAudio(speech);
                    }
                }
            } catch (error) {
                logger.error('Error processing voice command:', error);
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

        // Send to hardware
        await this.sendToHardware(`SET_TIMER:${id}:${duration}`);

        logger.info('Timer set', { id, duration });
        return id;
    }

    private async sendToHardware(command: string): Promise<void> {
        return new Promise((resolve, reject) => {
            this.serialPort.write(`${command}\n`, (error) => {
                if (error) {
                    reject(error);
                    return;
                }
                resolve();
            });
        });
    }

    private async handleTimerComplete(timerId: string): Promise<void> {
        const timer = this.timers.get(timerId);
        if (!timer || timer.completed) {
            return;
        }

        timer.completed = true;
        this.emit('timerComplete', timerId);

        try {
            // Ring the phone
            await this.phoneController.ring(3000); // Ring for 3 seconds
            
            // Play timer completion message when answered
            this.phoneController.once('off_hook', async () => {
                await this.phoneController.playTone('confirm');
                const speech = await this.aiService.generateSpeech("Your timer has completed.");
                await this.phoneController.playAudio(speech);
            });
        } catch (error) {
            logger.error('Error handling timer completion:', error);
        }
    }

    public async start(): Promise<void> {
        try {
            // Open serial connection
            await new Promise<void>((resolve, reject) => {
                this.serialPort.open((error) => {
                    if (error) {
                        reject(error);
                        return;
                    }
                    resolve();
                });
            });

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
                this.handleTimerComplete(id);
            }
        }
    }

    public getTimer(id: string): Timer | null {
        return this.timers.get(id) || null;
    }

    public async stop(): Promise<void> {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
        }

        // Cancel all timers
        for (const [id] of this.timers) {
            await this.cancelTimer(id);
        }

        // Close serial connection
        await new Promise<void>(resolve => this.serialPort.close(() => resolve()));
        
        logger.info('Timer service stopped');
    }

    public async cancelTimer(id: string): Promise<void> {
        const timer = this.timers.get(id);
        if (!timer) {
            throw new Error('Timer not found');
        }

        // Cancel on hardware
        await this.sendToHardware(`CANCEL_TIMER:${id}`);
        
        this.timers.delete(id);
        this.emit('timerCancelled', id);
        
        logger.info('Timer cancelled', { id });
    }
}