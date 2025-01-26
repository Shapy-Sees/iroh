// src/utils/logger.ts
//
// Enhanced logging system that provides structured logging with type safety.
// Supports multiple log levels, file rotation, and proper error handling.

import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';
import fs from 'fs';
import { LogMetadata } from '../types/logging';

// Define strict types according to spec
type LogLevel = 'error' | 'warn' | 'info' | 'debug';

interface LogMetadata {
    component?: string;
    error?: {
        message: string;
        name: string;
        stack?: string;
        code?: string;
    };
    context?: Record<string, unknown>;
    timestamp?: string;
    details?: Record<string, unknown>;
}

export class Logger {
    private logger: winston.Logger;
    private readonly logDir: string;

    constructor() {
        this.logDir = path.join(process.cwd(), 'logs');
        this.ensureLogDirectory();
        this.initializeLogger();
    }

    private ensureLogDirectory(): void {
        if (!fs.existsSync(this.logDir)) {
            fs.mkdirSync(this.logDir, { recursive: true });
        }
    }

    private initializeLogger(): void {
        this.logger = winston.createLogger({
            level: process.env.LOG_LEVEL || 'info',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.errors({ stack: true }),
                winston.format.json()
            ),
            transports: this.createTransports()
        });
    }

    private createTransports(): winston.transport[] {
        return [
            new winston.transports.Console({
                format: winston.format.combine(
                    winston.format.colorize(),
                    winston.format.simple()
                )
            }),
            new DailyRotateFile({
                dirname: this.logDir,
                filename: 'iroh-%DATE%.log',
                datePattern: 'YYYY-MM-DD',
                maxSize: '20m',
                maxFiles: '14d',
                format: winston.format.combine(
                    winston.format.timestamp(),
                    winston.format.json()
                )
            })
        ];
    }

    public error(message: string, metadata?: LogMetadata): void {
        const enrichedMetadata = this.enrichMetadata(metadata);
        this.logger.error(message, enrichedMetadata);
    }

    public warn(message: string, metadata?: Partial<LogMetadata>): void {
        const enrichedMetadata = this.enrichMetadata(metadata);
        this.logger.warn(message, enrichedMetadata);
    }

    public info(message: string, metadata?: Partial<LogMetadata>): void {
        const enrichedMetadata = this.enrichMetadata(metadata);
        this.logger.info(message, enrichedMetadata);
    }

    public debug(message: string, metadata?: Partial<LogMetadata>): void {
        const enrichedMetadata = this.enrichMetadata(metadata);
        this.logger.debug(message, enrichedMetadata);
    }

    private enrichMetadata(metadata?: LogMetadata): LogMetadata {
        return {
            timestamp: new Date().toISOString(),
            ...metadata,
            context: {
                nodeEnv: process.env.NODE_ENV,
                ...metadata?.context
            }
        };
    }

    public setLevel(level: LogLevel): void {
        this.logger.level = level;
    }

    /**
     * Print to console with proper formatting
     * Use this instead of console.log for debug output
     */
    public print(message: string, metadata?: Partial<LogMetadata>): void {
        if (process.env.NODE_ENV === 'development') {
            console.log(message);
        } else {
            this.info(message, metadata);
        }
    }

    /**
     * Print to console with proper formatting and preserve newlines
     * Use this for multi-line debug output
     */
    public printFormatted(message: string): void {
        if (process.env.NODE_ENV === 'development') {
            console.log(message.split('\n').join('\n'));
        } else {
            message.split('\n').forEach(line => this.info(line));
        }
    }
}

// Export singleton instance
export const logger = new Logger();