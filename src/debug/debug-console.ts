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
import { HardwareError, ServiceError } from '../types/errors';
import { AudioBuffer, DAHDIStatus } from '../types/hardware';

type MonitorType = 'audio' | 'hardware' | 'events';

interface DebugConsoleEvents {
    'off-hook': void;
    'on-hook': void;
    'dtmf': { digit: string; duration: number };
    'voice': [Buffer, string];
    'error': Error;
    'hardware-status': DAHDIChannelStatus;
    'audio-buffer': AudioBuffer;
}

interface DebugCommand {
    command: string;
    description: string;
    handler: (...args: string[]) => Promise<void>;
    category: 'hardware' | 'services' | 'system' | 'test';
}

export class DebugConsole extends EventEmitter {
    private readonly rl: readline.Interface;
    private readonly app: IrohApp;
    private readonly commands: Map<string, DebugCommand>;
    private isRunning = false;
    private lastCommand: string | null = null;
    private audioMonitoring = false;
    private hardwareMonitoring = false;

    constructor(app: IrohApp) {
        super();
        this.app = app;
        
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            prompt: 'iroh-debug> ',
            historySize: 100,
            removeHistoryDuplicates: true
        });

        this.commands = this.initializeCommands();
        this.setupHandlers();
        
        logger.level = 'debug';
    }

    public override emit<K extends keyof DebugConsoleEvents>(
        event: K,
        ...args: DebugConsoleEvents[K] extends void ? [] : [DebugConsoleEvents[K]]
    ): boolean {
        return super.emit(event, ...args);
    }

    public override on<K extends keyof DebugConsoleEvents>(
        event: K,
        listener: (arg: DebugConsoleEvents[K]) => void
    ): this {
        return super.on(event, listener);
    }

    private initializeCommands(): Map<string, DebugCommand> {
        const commands = new Map<string, DebugCommand>();

        // Basic system commands
        commands.set('help', {
            command: 'help',
            description: 'Show available commands',
            handler: async () => this.showHelp(),
            category: 'system'
        });

        commands.set('exit', {
            command: 'exit',
            description: 'Exit debug console',
            handler: async () => {
                await this.stop();
                process.exit(0);
            },
            category: 'system'
        });

        // Phone state simulation
        commands.set('off-hook', {
            command: 'off-hook',
            description: 'Simulate phone going off-hook',
            handler: async () => {
                logger.info('Debug: Simulating off-hook');
                this.emit('off-hook');
            },
            category: 'hardware'
        });

        commands.set('on-hook', {
            command: 'on-hook',
            description: 'Simulate phone going on-hook',
            handler: async () => {
                logger.info('Debug: Simulating on-hook');
                this.emit('on-hook');
            },
            category: 'hardware'
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
            },
            category: 'hardware'
        });

        commands.set('voice', {
            command: 'voice <text>',
            description: 'Simulate voice command',
            handler: async (...args: string[]) => {
                const text = args.join(' ');
                logger.info('Debug: Simulating voice command', { text });
                const dummyBuffer = Buffer.from('Voice simulation');
                this.emit('voice', dummyBuffer, text);
            },
            category: 'hardware'
        });

        // Hardware testing commands
        commands.set('hw-test', {
            command: 'hw-test [port]',
            description: 'Run hardware diagnostics on FXS port',
            handler: async (port: string = '1') => {
                await this.testHardware(parseInt(port));
            },
            category: 'hardware'
        });

        commands.set('monitor', {
            command: 'monitor <type>',
            description: 'Start monitoring (audio|hardware|events)',
            handler: async (type: string) => {
                await this.startMonitoring(type as MonitorType);
            },
            category: 'hardware'
        });

        commands.set('stop-monitor', {
            command: 'stop-monitor',
            description: 'Stop all monitoring',
            handler: async () => {
                await this.stopMonitoring();
            },
            category: 'hardware'
        });

        // Home Assistant testing
        commands.set('ha-status', {
            command: 'ha-status [entity]',
            description: 'Get Home Assistant entity status',
            handler: async (entity?: string) => {
                await this.checkHAStatus(entity);
            },
            category: 'services'
        });

        commands.set('ha-call', {
            command: 'ha-call <service> [data]',
            description: 'Call Home Assistant service',
            handler: async (service: string, data?: string) => {
                await this.callHAService(service, data ? JSON.parse(data) : undefined);
            },
            category: 'services'
        });

        // System commands
        commands.set('status', {
            command: 'status',
            description: 'Show detailed system status',
            handler: async () => {
                await this.showDetailedStatus();
            },
            category: 'system'
        });

        commands.set('test', {
            command: 'test <component>',
            description: 'Run test suite for component',
            handler: async (component: string) => {
                await this.runTests(component);
            },
            category: 'test'
        });

        return commands;
    }

    private setupHandlers(): void {
        this.rl.on('line', async (line: string) => {
            if (!this.isRunning) return;

            const [command, ...args] = line.trim().split(' ');
            const cmd = this.commands.get(command);

            if (cmd) {
                try {
                    this.lastCommand = command;
                    await cmd.handler(...args);
                } catch (error) {
                    logger.error('Command execution error:', { error, command });
                    console.error('Error:', error instanceof Error ? error.message : String(error));
                }
            } else if (command !== '') {
                console.log('Unknown command. Type "help" for available commands.');
            }

            this.rl.prompt();
        });

        this.rl.on('close', () => {
            void this.stop();
        });

        this.app.on('error', (error: Error) => {
            if (this.hardwareMonitoring) {
                logger.error('System error:', { error });
            }
        });
    }

    private async testHardware(port: number): Promise<void> {
        const phone = this.app.getPhoneController();
        logger.debug('Testing hardware', { port });
        
        try {
            await Promise.all([
                this.testLineVoltage(port),
                this.testRingGeneration(port),
                this.testAudioPath(port),
                this.testDTMF(port)
            ]);
            
            logger.info('Hardware test complete', { port });
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            logger.error('Hardware test failed', { port, error });
            throw new HardwareError(`Hardware test failed on port ${port}: ${message}`);
        }
    }

    private async testLineVoltage(port: number): Promise<void> {
        try {
            const phone = this.app.getPhoneController();
            const voltage = await phone.getLineVoltage(port);
            logger.info('Line voltage test', { port, voltage });
        } catch (error) {
            throw new HardwareError(`Line voltage test failed: ${String(error)}`);
        }
    }

    private async testRingGeneration(port: number): Promise<void> {
        try {
            const phone = this.app.getPhoneController();
            await phone.testRing(port);
            logger.info('Ring generation test complete', { port });
        } catch (error) {
            throw new HardwareError(`Ring generation test failed: ${String(error)}`);
        }
    }

    private async testAudioPath(port: number): Promise<void> {
        try {
            const testTone = this.generateTestTone();
            const phone = this.app.getPhoneController();
            await phone.playAudio(testTone);
            logger.info('Audio path test complete', { port });
        } catch (error) {
            throw new HardwareError(`Audio path test failed: ${String(error)}`);
        }
    }

    private async testDTMF(port: number): Promise<void> {
        try {
            const phone = this.app.getPhoneController();
            await phone.testDTMF(port);
            logger.info('DTMF test complete', { port });
        } catch (error) {
            throw new HardwareError(`DTMF test failed: ${String(error)}`);
        }
    }

    private async startMonitoring(type: MonitorType): Promise<void> {
        switch (type) {
            case 'audio':
                this.audioMonitoring = true;
                logger.info('Audio monitoring started');
                break;
                
            case 'hardware':
                this.hardwareMonitoring = true;
                logger.info('Hardware monitoring started');
                this.monitorHardwareStatus();
                break;
                
            case 'events':
                logger.info('Event monitoring started');
                break;
                
            default:
                const exhaustiveCheck: never = type;
                throw new Error(`Unhandled monitoring type: ${exhaustiveCheck}`);
        }
    }

    private async stopMonitoring(): Promise<void> {
        this.audioMonitoring = false;
        this.hardwareMonitoring = false;
        console.log('All monitoring stopped');
    }

    private async checkHAStatus(entity?: string): Promise<void> {
        const services = this.app.getServiceManager();
        
        try {
            if (entity) {
                const status = await services.getHAEntityStatus(entity);
                logger.info('Entity status', { entity, status });
            } else {
                const status = await services.getHAStatus();
                logger.info('Home Assistant status', { status });
            }
        } catch (error) {
            logger.error('Error checking HA status', { error, entity });
            throw new ServiceError(`Failed to get HA status: ${String(error)}`);
        }
    }

    private async callHAService(service: string, data?: unknown): Promise<void> {
        const services = this.app.getServiceManager();
        
        try {
            await services.callHAService(service, data);
            logger.info('Service call complete', { service });
        } catch (error) {
            logger.error('Service call failed', { service, error });
            throw new ServiceError(`Failed to call service ${service}: ${String(error)}`);
        }
    }

    private async showDetailedStatus(): Promise<void> {
        try {
            const phone = this.app.getPhoneController();
            const services = this.app.getServiceManager();
            
            const status = {
                phone: {
                    state: phone.isOpen() ? 'Active' : 'Inactive',
                    lastCommand: this.lastCommand,
                    monitoring: {
                        audio: this.audioMonitoring,
                        hardware: this.hardwareMonitoring
                    }
                },
                services: await services.getStatus()
            };
            
            logger.info('System status', status);
            
        } catch (error) {
            logger.error('Error showing status', { error });
            throw new Error(`Failed to get system status: ${String(error)}`);
        }
    }

    private generateTestTone(): Buffer {
        const sampleRate = 8000;
        const duration = 1;
        const frequency = 440;
        const samples = sampleRate * duration;
        const buffer = Buffer.alloc(samples * 2);
        
        try {
            for (let i = 0; i < samples; i++) {
                const value = Math.sin(2 * Math.PI * frequency * i / sampleRate) * 0x7FFF;
                buffer.writeInt16LE(Math.floor(value), i * 2);
            }
            return buffer;
        } catch (error) {
            logger.error('Error generating test tone', { error });
            throw new Error(`Failed to generate test tone: ${String(error)}`);
        }
    }

    private async runTests(component: string): Promise<void> {
        logger.debug('Starting test suite', { component });
        
        try {
            switch (component.toLowerCase()) {
                case 'audio':
                case 'dtmf':
                case 'ha':
                    await this[`run${component.toUpperCase()}Tests`]();
                    break;
                default:
                    throw new Error(`Unknown test component: ${component}`);
            }
            
            logger.info('Test suite complete', { component });
        } catch (error) {
            logger.error('Test execution failed', { component, error });
            throw new Error(`Test suite failed: ${String(error)}`);
        }
    }

    private showHelp(): void {
        logger.info('\nAvailable Commands:');
        
        // Group commands by category
        const categories = new Map<string, DebugCommand[]>();
        for (const cmd of this.commands.values()) {
            const category = cmd.category;
            if (!categories.has(category)) {
                categories.set(category, []);
            }
            categories.get(category)!.push(cmd);
        }
        
        // Print commands by category
        for (const [category, commands] of categories) {
            logger.info(`\n${category.toUpperCase()}:`);
            for (const cmd of commands) {
                logger.info(`  ${cmd.command.padEnd(20)} - ${cmd.description}`);
            }
        }
        logger.info('');
    }

    public async start(): Promise<void> {
        this.isRunning = true;
        logger.info('\nIroh Debug Console');
        logger.info('Type "help" for available commands\n');
        this.rl.prompt();
    }

    public async stop(): Promise<void> {
        this.isRunning = false;
        await this.stopMonitoring();
        this.rl.close();
        await this.app.shutdown();
    }

    private async runAudioTests(): Promise<void> {
        // Implementation
        logger.debug('Running audio tests');
    }

    private async runDTMFTests(): Promise<void> {
        // Implementation
        logger.debug('Running DTMF tests');
    }

    private async runHATests(): Promise<void> {
        // Implementation
        logger.debug('Running HA tests');
    }

    // Add new debug methods
    private async simulateError(type: string, details?: Record<string, unknown>): Promise<void> {
        switch (type) {
            case 'hardware':
                this.emit('error', new HardwareError('Simulated hardware error', details));
                break;
            case 'service':
                this.emit('error', new ServiceError('Simulated service error', details));
                break;
            default:
                throw new Error(`Unknown error type: ${type}`);
        }
    }

    private async monitorHardwareStatus(): Promise<void> {
        if (!this.hardwareMonitoring) return;

        const phone = this.app.getPhoneController();
        const status = await phone.getStatus();
        this.emit('hardware-status', status);
        
        setTimeout(() => this.monitorHardwareStatus(), 1000);
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