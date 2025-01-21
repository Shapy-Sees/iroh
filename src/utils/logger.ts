// src/utils/logger.ts
//
// Key Features:
// - Multiple log levels (DEBUG, INFO, WARN, ERROR)
// - File and console output
// - Structured JSON logging
// - Timestamp and context tracking
// - Rotating file logs
// - Custom formatters
// - Performance monitoring
//
// Usage:
// import { logger } from '../utils/logger';
// logger.info('Starting service', { context: 'startup' });
// logger.error('Failed to process', { error, metadata });

import winston from 'winston';
import path from 'path';
import DailyRotateFile from 'winston-daily-rotate-file';

interface LoggerConfig {
    level: string;
    logDir: string;
    maxFiles: string;
    maxSize: string;
    console: boolean;
    format: 'json' | 'simple';
}

class IrohLogger {
    private logger: winston.Logger;
    private config: LoggerConfig;

    constructor(config?: Partial<LoggerConfig>) {
        this.config = {
            level: 'info',
            logDir: 'logs',
            maxFiles: '14d',  // Keep logs for 14 days
            maxSize: '20m',   // 20MB per file
            console: true,    // Enable console output
            format: 'json',   // Use JSON format by default
            ...config
        };

        // Initialize logger immediately
        this.logger = this.createLogger();
    }

    private createLogger(): winston.Logger {
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
            exceptionHandlers: [fileTransport],
            rejectionHandlers: [fileTransport],
            exitOnError: false
        });
    }

    private addMetadata(metadata: object = {}): object {
        return {
            timestamp: new Date().toISOString(),
            pid: process.pid,
            hostname: require('os').hostname(),
            ...metadata
        };
    }

    public debug(message: string, metadata: object = {}): void {
        this.logger.debug(message, this.addMetadata(metadata));
    }

    public info(message: string, metadata: object = {}): void {
        this.logger.info(message, this.addMetadata(metadata));
    }

    public warn(message: string, metadata: object = {}): void {
        this.logger.warn(message, this.addMetadata(metadata));
    }

    public error(message: string, error?: Error, metadata: object = {}): void {
        const errorMetadata = error ? {
            error: {
                message: error.message,
                stack: error.stack,
                name: error.name
            },
            ...metadata
        } : metadata;

        this.logger.error(message, this.addMetadata(errorMetadata));
    }

    public startTimer(label: string): () => void {
        const start = process.hrtime();
        return () => {
            const [seconds, nanoseconds] = process.hrtime(start);
            const duration = seconds * 1000 + nanoseconds / 1e6;
            this.debug(`Timer ${label} completed`, { duration: `${duration}ms` });
        };
    }

    public async profile<T>(label: string, fn: () => Promise<T>): Promise<T> {
        const end = this.startTimer(label);
        return fn().finally(end);
    }

    // Update query method with correct types
    public async query(options: winston.QueryOptions): Promise<object[]> {
        return new Promise((resolve) => {
            const results: object[] = [];
            const stream = this.logger.query({
                ...options,
                fields: ['message', 'level', 'timestamp']
            });
            
            stream.on('data', (log) => results.push(log));
            stream.on('end', () => resolve(results));
        });
    }
}

// Create and export singleton instance
export const logger = new IrohLogger({
    level: process.env.LOG_LEVEL || 'info',
    logDir: process.env.LOG_DIR || 'logs',
    console: process.env.NODE_ENV !== 'production'
});