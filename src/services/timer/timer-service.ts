// src/services/timer/timer-service.ts
//
// A service that manages countdown timers and coordinates 
// between hardware device notifications and phone ringing.
// Uses serialport package for hardware communication.

import { EventEmitter } from 'events';
import SerialPort from 'serialport';
import { PhoneController } from '../../controllers/phone-controller';
import { IrohAIService } from '../ai/ai-service';
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
    private serialPort: SerialPort | null = null;
    private checkInterval: NodeJS.Timeout | null = null;
    private readonly config: Required<TimerConfig>;
    private reconnectAttempts: number = 0;
    private readonly MAX_RECONNECT_ATTEMPTS = 5;

    constructor(
        config: Partial<TimerConfig>,
        private phone: PhoneController,
        private ai: IrohAIService
    ) {
        super();
        
        // Set config with defaults
        this.config = {
            devicePath: '/dev/ttyUSB1',
            baudRate: 9600,
            maxTimers: 5,
            maxDuration: 180, // 3 hours max
            ...config
        };

        this.timers = new Map();
        
        // Setup event handlers
        this.setupVoiceCommands();
    }

    private async initializeSerialPort(): Promise<void> {
        try {
            // If we already have a port, close it first
            if (this.serialPort) {
                this.serialPort.removeAllListeners();
                await new Promise<void>((resolve) => {
                    if (this.serialPort?.isOpen) {
                        this.serialPort.close(() => resolve());
                    } else {
                        resolve();
                    }
                });
            }

            // Create new serial port instance
            this.serialPort = new SerialPort(this.config.devicePath, {
                baudRate: this.config.baudRate,
                autoOpen: false
            });

            // Set up event handlers
            this.serialPort.on('open', () => {
                logger.info('Timer hardware connection established');
                this.reconnectAttempts = 0;
            });

            this.serialPort.on('error', (error: Error) => {
                logger.error('Timer hardware error:', error);
                this.handleSerialError(error);
            });

            this.serialPort.on('close', () => {
                logger.warn('Serial port closed unexpectedly');
                this.handleSerialClose();
            });

            this.serialPort.on('data', (data: Buffer) => {
                this.handleSerialData(data);
            });

            // Open the port
            await new Promise<void>((resolve, reject) => {
                if (!this.serialPort) {
                    reject(new Error('Serial port not initialized'));
                    return;
                }

                this.serialPort.open((err) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve();
                    }
                });
            });

        } catch (error) {
            logger.error('Failed to initialize serial port:', error);
            throw error;
        }
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

    private handleSerialError(error: Error): void {
        logger.error('Serial port error:', error);
        this.emit('error', error);
        this.attemptReconnect();
    }

    private handleSerialClose(): void {
        logger.warn('Serial port closed');
        this.attemptReconnect();
    }

    private async attemptReconnect(): Promise<void> {
        if (this.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
            logger.error('Max reconnection attempts reached');
            this.emit('error', new Error('Unable to establish serial connection'));
            return;
        }

        this.reconnectAttempts++;
        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);

        logger.info(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);

        setTimeout(async () => {
            try {
                await this.initializeSerialPort();
                logger.info('Serial connection reestablished');
            } catch (error) {
                logger.error('Reconnection attempt failed:', error);
            }
        }, delay);
    }

    private handleSerialData(data: Buffer): void {
        try {
            const message = data.toString().trim();
            if (message.startsWith('TIMER_COMPLETE:')) {
                const timerId = message.split(':')[1];
                this.handleTimerComplete(timerId).catch((error) => {
                    logger.error('Error handling timer completion:', error);
                });
            }
        } catch (error) {
            logger.error('Error processing serial data:', error);
        }
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
        if (!this.serialPort?.isOpen) {
            throw new Error('Serial port not open');
        }

        return new Promise<void>((resolve, reject) => {
            this.serialPort?.write(`${command}\n`, (error) => {
                if (error) {
                    reject(error);
                    return;
                }
                this.serialPort?.drain(() => resolve());
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
            await this.phone.playTone('busy');
            
            // Play timer completion message when answered
            this.phone.once('off_hook', async () => {
                await this.phone.playTone('confirm');
                const speech = await this.ai.generateSpeech("Your timer has completed.");
                await this.phone.playAudio(speech);
            });
        } catch (error) {
            logger.error('Error handling timer completion:', error);
        }
    }

    public async start(): Promise<void> {
        try {
            // Initialize serial connection
            await this.initializeSerialPort();

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

        // Close serial connection
        if (this.serialPort?.isOpen) {
            await new Promise<void>((resolve) => {
                this.serialPort?.close(() => resolve());
            });
        }

        this.serialPort = null;
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