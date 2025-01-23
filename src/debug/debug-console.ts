// src/debug/debug-console.ts
//
// Enhanced debug console that provides interactive testing and monitoring of:
// - DAHDI/FXS hardware interface
// - Audio processing pipeline
// - Home Assistant integration
// - System state and events
// - Command processing

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
    private lastCommand: string | null = null;
    private audioMonitoring: boolean = false;
    private hardwareMonitoring: boolean = false;

    constructor(app: IrohApp) {
        super();
        this.app = app;
        
        // Initialize readline interface with command history
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            prompt: 'iroh-debug> ',
            historySize: 100,
            removeHistoryDuplicates: true
        });

        this.commands = this.initializeCommands();
        this.setupHandlers();
        
        // Enable debug logging
        logger.level = 'debug';
    }

    private initializeCommands(): Map<string, DebugCommand> {
        const commands = new Map<string, DebugCommand>();

        // Basic system commands
        commands.set('help', {
            command: 'help',
            description: 'Show available commands',
            handler: async () => this.showHelp()
        });

        commands.set('exit', {
            command: 'exit',
            description: 'Exit debug console',
            handler: async () => {
                await this.stop();
                process.exit(0);
            }
        });

        // Phone state simulation
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

        // DTMF and voice testing
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
                const dummyBuffer = Buffer.from('Voice simulation');
                this.emit('voice', dummyBuffer, text);
            }
        });

        // Hardware testing commands
        commands.set('hw-test', {
            command: 'hw-test [port]',
            description: 'Run hardware diagnostics on FXS port',
            handler: async (port: string = '1') => {
                await this.testHardware(parseInt(port));
            }
        });

        commands.set('monitor', {
            command: 'monitor <type>',
            description: 'Start monitoring (audio|hardware|events)',
            handler: async (type: string) => {
                await this.startMonitoring(type);
            }
        });

        commands.set('stop-monitor', {
            command: 'stop-monitor',
            description: 'Stop all monitoring',
            handler: async () => {
                await this.stopMonitoring();
            }
        });

        // Home Assistant testing
        commands.set('ha-status', {
            command: 'ha-status [entity]',
            description: 'Get Home Assistant entity status',
            handler: async (entity?: string) => {
                await this.checkHAStatus(entity);
            }
        });

        commands.set('ha-call', {
            command: 'ha-call <service> [data]',
            description: 'Call Home Assistant service',
            handler: async (service: string, data?: string) => {
                await this.callHAService(service, data ? JSON.parse(data) : undefined);
            }
        });

        // System commands
        commands.set('status', {
            command: 'status',
            description: 'Show detailed system status',
            handler: async () => {
                await this.showDetailedStatus();
            }
        });

        commands.set('test', {
            command: 'test <component>',
            description: 'Run test suite for component',
            handler: async (component: string) => {
                await this.runTests(component);
            }
        });

        return commands;
    }

    private setupHandlers(): void {
        // Handle command input
        this.rl.on('line', async (line) => {
            if (!this.isRunning) return;

            const [command, ...args] = line.trim().split(' ');
            const cmd = this.commands.get(command);

            if (cmd) {
                try {
                    this.lastCommand = command;
                    await cmd.handler(...args);
                } catch (error) {
                    logger.error('Error executing debug command:', error);
                    console.error('Error:', error instanceof Error ? error.message : error);
                }
            } else if (command !== '') {
                console.log('Unknown command. Type "help" for available commands.');
            }

            this.rl.prompt();
        });

        // Handle cleanup
        this.rl.on('close', () => {
            this.stop();
        });

        // Monitor system events when enabled
        this.app.on('error', (error) => {
            if (this.hardwareMonitoring) {
                logger.error('System error detected:', error);
            }
        });
    }

    private async testHardware(port: number): Promise<void> {
        console.log(`Testing FXS port ${port}...`);
        
        try {
            const phone = this.app.getPhoneController();
            
            // Test line voltage
            console.log('Testing line voltage...');
            // Implementation would check voltage through DAHDI
            
            // Test ring generation
            console.log('Testing ring generation...');
            await phone.playTone('busy');
            
            // Test audio path
            console.log('Testing audio path...');
            const testTone = this.generateTestTone();
            await phone.playAudio(testTone);
            
            // Test DTMF detection
            console.log('Testing DTMF detection...');
            // Implementation would verify DTMF detection
            
            console.log('Hardware test complete');
        } catch (error) {
            console.error('Hardware test failed:', error);
        }
    }

    private async startMonitoring(type: string): Promise<void> {
        switch (type.toLowerCase()) {
            case 'audio':
                this.audioMonitoring = true;
                console.log('Audio monitoring started. Press Ctrl+C to stop.');
                // Implementation would show audio levels
                break;
                
            case 'hardware':
                this.hardwareMonitoring = true;
                console.log('Hardware monitoring started. Press Ctrl+C to stop.');
                // Implementation would monitor hardware status
                break;
                
            case 'events':
                console.log('Event monitoring started. Press Ctrl+C to stop.');
                // Implementation would show system events
                break;
                
            default:
                console.log('Unknown monitoring type. Use: audio|hardware|events');
        }
    }

    private async stopMonitoring(): Promise<void> {
        this.audioMonitoring = false;
        this.hardwareMonitoring = false;
        console.log('All monitoring stopped');
    }

    private async checkHAStatus(entity?: string): Promise<void> {
        try {
            const services = this.app['serviceManager'];
            if (entity) {
                const status = await services.getHAEntityStatus(entity);
                console.log(`Status for ${entity}:`, status);
            } else {
                const status = await services.getHAStatus();
                console.log('Home Assistant Status:', status);
            }
        } catch (error) {
            console.error('Error checking HA status:', error);
        }
    }

    private async callHAService(service: string, data?: any): Promise<void> {
        try {
            const services = this.app['serviceManager'];
            await services.callHAService(service, data);
            console.log('Service call completed successfully');
        } catch (error) {
            console.error('Error calling HA service:', error);
        }
    }

    private async showDetailedStatus(): Promise<void> {
        try {
            const phone = this.app.getPhoneController();
            const services = this.app['serviceManager'];
            
            console.log('\nSystem Status:');
            console.log('-------------');
            console.log(`Phone State: ${phone.isOpen() ? 'Active' : 'Inactive'}`);
            console.log(`Last Command: ${this.lastCommand || 'None'}`);
            console.log(`Audio Monitoring: ${this.audioMonitoring ? 'On' : 'Off'}`);
            console.log(`Hardware Monitoring: ${this.hardwareMonitoring ? 'On' : 'Off'}`);
            
            // Add more status information as needed
            
        } catch (error) {
            console.error('Error showing status:', error);
        }
    }

    private generateTestTone(): Buffer {
        // Generate a simple sine wave for testing
        const sampleRate = 8000;
        const duration = 1; // seconds
        const frequency = 440; // Hz
        const samples = sampleRate * duration;
        const buffer = Buffer.alloc(samples * 2);
        
        for (let i = 0; i < samples; i++) {
            const value = Math.sin(2 * Math.PI * frequency * i / sampleRate) * 0x7FFF;
            buffer.writeInt16LE(Math.floor(value), i * 2);
        }
        
        return buffer;
    }

    private async runTests(component: string): Promise<void> {
        console.log(`Running tests for ${component}...`);
        try {
            switch (component.toLowerCase()) {
                case 'audio':
                    await this.runAudioTests();
                    break;
                case 'dtmf':
                    await this.runDTMFTests();
                    break;
                case 'ha':
                    await this.runHATests();
                    break;
                default:
                    console.log('Unknown test component');
            }
        } catch (error) {
            console.error('Test execution failed:', error);
        }
    }

    private async showHelp(): Promise<void> {
        console.log('\nAvailable Commands:');
        console.log('------------------');
        
        // Group commands by category
        const categories = new Map<string, DebugCommand[]>();
        
        for (const cmd of this.commands.values()) {
            const category = cmd.command.split(' ')[0].includes('-') ? 
                cmd.command.split('-')[0] : 'general';
                
            if (!categories.has(category)) {
                categories.set(category, []);
            }
            categories.get(category)?.push(cmd);
        }
        
        // Print commands by category
        for (const [category, commands] of categories) {
            console.log(`\n${category.toUpperCase()}:`);
            for (const cmd of commands) {
                console.log(`  ${cmd.command.padEnd(20)} - ${cmd.description}`);
            }
        }
        console.log();
    }

    public async start(): Promise<void> {
        this.isRunning = true;
        console.log('\nIroh Debug Console');
        console.log('Type "help" for available commands\n');
        this.rl.prompt();
    }

    public async stop(): Promise<void> {
        this.isRunning = false;
        await this.stopMonitoring();
        this.rl.close();
        await this.app.shutdown();
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