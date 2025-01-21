// src/utils/logger.ts
//
// Enhanced logger implementation that provides both local file logging 
// and external logging via HTTP Event Collector (HEC).
// Includes comprehensive error handling, retry logic, and type safety.

import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import axios, { AxiosInstance } from 'axios';
import { EventEmitter } from 'events';

// Define strongly typed interfaces
interface HECConfig {
    url: string;
    token: string;
    batchSize: number;
    batchTimeout: number;
    maxRetries: number;
    retryDelay: number;
    index: string;
    sourcetype: string;
    source: string;
}

interface LoggerConfig {
    level: string;
    logDir: string;
    maxFiles: string;
    maxSize: string;
    console: boolean;
    format: 'json' | 'simple';
    hec?: Partial<HECConfig> | null;
}

const DEFAULT_HEC_CONFIG: HECConfig = {
    url: '',
    token: '',
    batchSize: 100,
    batchTimeout: 5000,
    maxRetries: 3,
    retryDelay: 1000,
    index: 'iroh_logs',
    sourcetype: 'iroh:app',
    source: 'iroh_application'
};

class HECTransport extends EventEmitter {
    private client: AxiosInstance;
    private queue: any[] = [];
    private timer: NodeJS.Timeout | null = null;
    private isProcessing: boolean = false;
    private retryCount: number = 0;

    constructor(private config: HECConfig) {
        super();
        
        this.client = axios.create({
            baseURL: config.url,
            headers: {
                'Authorization': `Splunk ${config.token}`,
                'Content-Type': 'application/json'
            },
            timeout: 5000
        });

        this.startTimer();
    }

    public startTimer(): void {
        if (this.timer) {
            clearInterval(this.timer);
        }

        this.timer = setInterval(() => {
            if (this.queue.length > 0) {
                this.processBatch().catch(error => {
                    this.emit('error', error);
                });
            }
        }, this.config.batchTimeout);
    }

    public async log(data: any): Promise<void> {
        this.queue.push({
            time: Date.now() / 1000,
            index: this.config.index,
            sourcetype: this.config.sourcetype,
            source: this.config.source,
            event: data
        });

        if (this.queue.length >= this.config.batchSize) {
            await this.processBatch();
        }
    }

    private async processBatch(): Promise<void> {
        if (this.isProcessing || this.queue.length === 0) {
            return;
        }

        this.isProcessing = true;
        const batch = this.queue.splice(0, this.config.batchSize);

        try {
            await this.sendBatch(batch);
            this.retryCount = 0;
            this.emit('sent', batch.length);
        } catch (error) {
            await this.handleError(error, batch);
        } finally {
            this.isProcessing = false;
        }
    }

    private async sendBatch(batch: any[]): Promise<void> {
        try {
            await this.client.post('/services/collector/event', {
                events: batch
            });
        } catch (error) {
            if (this.retryCount < this.config.maxRetries) {
                this.retryCount++;
                await new Promise(resolve => 
                    setTimeout(resolve, this.config.retryDelay * this.retryCount)
                );
                throw error;
            }
            this.emit('error', error);
            batch.forEach(event => {
                this.emit('failed', event);
            });
        }
    }

    private async handleError(error: any, batch: any[]): Promise<void> {
        console.error('HEC transport error:', error);
        if (this.retryCount < this.config.maxRetries) {
            this.queue.unshift(...batch);
            this.emit('retry', {
                count: this.retryCount,
                events: batch.length
            });
        } else {
            this.emit('drop', batch);
        }
    }

    public shutdown(): void {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        
        if (this.queue.length > 0) {
            this.processBatch().catch(error => {
                this.emit('error', error);
            });
        }
    }
}

export class IrohLogger {
    private logger: winston.Logger;
    private config: LoggerConfig;
    private hecTransport: HECTransport | null = null;

    constructor(config?: Partial<LoggerConfig>) {
        this.config = {
            level: 'info',
            logDir: 'logs',
            maxFiles: '14d',
            maxSize: '20m',
            console: true,
            format: 'json',
            hec: null,
            ...config
        };

        this.logger = this.initializeLogger();

        if (this.config.hec) {
            this.initializeHEC();
        }
    }

    private initializeLogger(): winston.Logger {
        const formats = {
            json: winston.format.combine(
                winston.format.timestamp(),
                winston.format.errors({ stack: true }),
                winston.format.json()
            ),
            simple: winston.format.combine(
                winston.format.colorize(),
                winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
                winston.format.printf(({ level, message, timestamp, ...metadata }) => {
                    let msg = `${timestamp} [${level}]: ${message}`;
                    if (Object.keys(metadata).length > 0) {
                        msg += ` ${JSON.stringify(metadata)}`;
                    }
                    return msg;
                })
            )
        };

        const fileTransport = new DailyRotateFile({
            dirname: this.config.logDir,
            filename: 'iroh-%DATE%.log',
            datePattern: 'YYYY-MM-DD',
            maxFiles: this.config.maxFiles,
            maxSize: this.config.maxSize,
            format: formats.json
        });

        const transports: winston.transport[] = [fileTransport];

        if (this.config.console) {
            transports.push(new winston.transports.Console({
                format: formats.simple
            }));
        }

        return winston.createLogger({
            level: this.config.level,
            transports,
            exitOnError: false
        });
    }

    private initializeHEC(): void {
        if (!this.config.hec) return;

        const hecConfig: HECConfig = {
            ...DEFAULT_HEC_CONFIG,
            ...this.config.hec
        };

        if (!hecConfig.url || !hecConfig.token) {
            this.logger.warn('HEC configuration missing required url or token - HEC transport disabled');
            return;
        }

        this.hecTransport = new HECTransport(hecConfig);

        this.hecTransport.on('error', (error) => {
            this.logger.error('HEC transport error', { error });
        });

        this.hecTransport.on('retry', (info) => {
            this.logger.warn('Retrying HEC batch', info);
        });

        this.hecTransport.on('drop', (batch) => {
            this.logger.error('Dropped HEC batch', { size: batch.length });
        });
    }

    public async debug(message: string, metadata: object = {}): Promise<void> {
        this.logger.debug(message, metadata);
        await this.sendToHEC('debug', message, metadata);
    }

    public async info(message: string, metadata: object = {}): Promise<void> {
        this.logger.info(message, metadata);
        await this.sendToHEC('info', message, metadata);
    }

    public async warn(message: string, metadata: object = {}): Promise<void> {
        this.logger.warn(message, metadata);
        await this.sendToHEC('warn', message, metadata);
    }

    public async error(message: string, error?: Error, metadata: object = {}): Promise<void> {
        const errorMetadata = error ? {
            error: {
                message: error.message,
                stack: error.stack,
                name: error.name
            },
            ...metadata
        } : metadata;

        this.logger.error(message, errorMetadata);
        await this.sendToHEC('error', message, errorMetadata);
    }

    private async sendToHEC(level: string, message: string, metadata: object): Promise<void> {
        if (this.hecTransport) {
            const logData = {
                level,
                message,
                timestamp: new Date().toISOString(),
                ...this.addMetadata(metadata)
            };

            await this.hecTransport.log(logData);
        }
    }

    private addMetadata(metadata: object = {}): object {
        return {
            pid: process.pid,
            hostname: require('os').hostname(),
            environment: process.env.NODE_ENV,
            version: process.env.npm_package_version,
            ...metadata
        };
    }

    public async shutdown(): Promise<void> {
        if (this.hecTransport) {
            this.hecTransport.shutdown();
        }
        
        await new Promise<void>((resolve) => {
            this.logger.on('finish', resolve);
            this.logger.end();
        });
    }
}

// Create and export singleton instance with safe environment variable handling
export const logger = new IrohLogger({
    level: process.env.LOG_LEVEL || 'info',
    logDir: process.env.LOG_DIR || 'logs',
    console: process.env.NODE_ENV !== 'production',
    hec: process.env.HEC_URL && process.env.HEC_TOKEN ? {
        url: process.env.HEC_URL,
        token: process.env.HEC_TOKEN,
        index: process.env.HEC_INDEX || DEFAULT_HEC_CONFIG.index,
        sourcetype: process.env.HEC_SOURCETYPE || DEFAULT_HEC_CONFIG.sourcetype
    } : null
});