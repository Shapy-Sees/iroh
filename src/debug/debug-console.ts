// src/debug/debug-console.ts
//
// A debug console interface that allows developers to:
// - Simulate phone events (off-hook, on-hook)
// - Send DTMF tones
// - Test voice commands
// - Monitor system state
// - Trigger and test timers
// - View logs in real-time

import readline from 'readline';
import { EventEmitter } from 'events';
import { IrohApp } from '../app';
import { logger } from '../utils/logger';
import { PhoneController } from '../controllers/phone-controller';
import { ServiceManager } from '../services/service-manager';

interface DebugCommand {
    command: string;
    description: string;
    handler: (...args: string[]) => Promise<void>;
}

export class DebugConsole extends EventEmitter {
    private rl: readline.Interface;
    private app: IrohApp;
    private commands: Map<string, DebugCommand>;
    private isRunning: boolean = false;

    constructor(app: IrohApp) {
        super();
        this.app = app;
        
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            prompt: 'iroh-debug> '
        });

        this.commands = this.initializeCommands();
        this.setupHandlers();
    }

    private initializeCommands(): Map<string, DebugCommand> {
        const commands = new Map<string, DebugCommand>();

        commands.set('help', {
            command: 'help',
            description: 'Show available commands',
            handler: async () => this.showHelp()
        });

        commands.set('off-hook', {
            command: 'off-hook',
            description: 'Simulate phone going off-hook',
            handler: async () => {
                logger.info('Debug: Simulating off-hook');
                this.emit('off-hook');
            }
        });

        commands.set('on-hook', {
            command: 'on-hook',
            description: 'Simulate phone going on-hook',
            handler: async () => {
                logger.info('Debug: Simulating on-hook');
                this.emit('on-hook');
            }
        });

        commands.set('dtmf', {
            command: 'dtmf <digit>',
            description: 'Send DTMF tone (0-9, *, #)',
            handler: async (digit: string) => {
                if (!/^[0-9*#]$/.test(digit)) {
                    console.log('Invalid DTMF digit. Use 0-9, *, or #');
                    return;
                }
                logger.info('Debug: Sending DTMF', { digit });
                this.emit('dtmf', { digit, duration: 100 });
            }
        });

        commands.set('voice', {
            command: 'voice <text>',
            description: 'Simulate voice command',
            handler: async (...args: string[]) => {
                const text = args.join(' ');
                logger.info('Debug: Simulating voice command', { text });
                // Create dummy audio buffer for voice simulation
                const dummyBuffer = Buffer.from('Voice simulation');
                this.emit('voice', dummyBuffer, text);
            }
        });

        commands.set('timer', {
            command: 'timer <minutes>',
            description: 'Set a timer',
            handler: async (minutes: string) => {
                const duration = parseInt(minutes);
                if (isNaN(duration) || duration <= 0) {
                    console.log('Invalid duration. Please specify minutes > 0');
                    return;
                }
                logger.info('Debug: Setting timer', { duration });
                this.emit('timer', duration);
            }
        });

        commands.set('status', {
            command: 'status',
            description: 'Show system status',
            handler: async () => {
                this.showStatus();
            }
        });

        commands.set('exit', {
            command: 'exit',
            description: 'Exit debug console',
            handler: async () => {
                await this.stop();
                process.exit(0);
            }
        });

        return commands;
    }

    private setupHandlers(): void {
        this.rl.on('line', async (line) => {
            if (!this.isRunning) return;

            const [command, ...args] = line.trim().split(' ');
            const cmd = this.commands.get(command);

            if (cmd) {
                try {
                    await cmd.handler(...args);
                } catch (error) {
                    logger.error('Error executing debug command:', error);
                    console.error('Error:', error);
                }
            } else if (command !== '') {
                console.log('Unknown command. Type "help" for available commands.');
            }

            this.rl.prompt();
        });

        this.rl.on('close', () => {
            this.stop();
        });
    }

    public async start(): Promise<void> {
        this.isRunning = true;
        console.log('\nIroh Debug Console');
        console.log('Type "help" for available commands\n');
        this.rl.prompt();
    }

    public async stop(): Promise<void> {
        this.isRunning = false;
        this.rl.close();
        await this.app.shutdown();
    }

    private async showHelp(): Promise<void> {
        console.log('\nAvailable Commands:');
        for (const cmd of this.commands.values()) {
            console.log(`  ${cmd.command.padEnd(20)} - ${cmd.description}`);
        }
        console.log();
    }

    private async showStatus(): Promise<void> {
        // You can expand this to show more detailed system status
        console.log('\nSystem Status:');
        console.log('  Phone: Off-hook');
        console.log('  Active Timers: 0');
        console.log('  Music: Stopped');
        console.log('  Last Command: None');
        console.log();
    }
}

// Example usage in src/app.ts:
if (process.env.NODE_ENV === 'development') {
    const app = new IrohApp();
    const debugConsole = new DebugConsole(app);

    // Connect debug console events to phone controller
    debugConsole.on('off-hook', () => {
        app.getPhoneController().emit('off_hook');
    });

    debugConsole.on('on-hook', () => {
        app.getPhoneController().emit('on_hook');
    });

    debugConsole.on('dtmf', (event) => {
        app.getPhoneController().emit('dtmf', event);
    });

    debugConsole.on('voice', (buffer, text) => {
        app.getPhoneController().emit('voice', buffer);
    });

    // Start both the app and debug console
    Promise.all([
        app.start(),
        debugConsole.start()
    ]).catch(error => {
        logger.error('Failed to start debug session:', error);
        process.exit(1);
    });
}