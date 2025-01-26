// src/utils/logger.ts
//
// Enhanced logging system that provides structured logging with type safety.
// Supports multiple log levels, file rotation, and proper error handling.

import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';

// Define log level type for type safety
type LogLevel = 'error' | 'warn' | 'info' | 'debug';

// Define error metadata interface
interface ErrorMetadata {
    error: Error;
    context?: Record<string, any>;
}

export class Logger {
    private logger: winston.Logger;

    constructor() {
        // Ensure logs directory exists
        const logDir = path.join(process.cwd(), 'logs');

        // Create Winston logger instance with proper configuration
        this.logger = winston.createLogger({
            level: process.env.LOG_LEVEL || 'info',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.errors({ stack: true }),
                winston.format.json()
            ),
            transports: [
                // Console transport for development
                new winston.transports.Console({
                    format: winston.format.combine(
                        winston.format.colorize(),
                        winston.format.simple()
                    )
                }),
                // File transport with rotation
                new DailyRotateFile({
                    dirname: logDir,
                    filename: 'iroh-%DATE%.log',
                    datePattern: 'YYYY-MM-DD',
                    maxSize: '20m',
                    maxFiles: '14d',
                    format: winston.format.combine(
                        winston.format.timestamp(),
                        winston.format.json()
                    )
                })
            ]
        });
    }

    // Type-safe error logging
    public error(message: string, error?: Error | unknown): void {
        if (error instanceof Error) {
            this.logger.error(message, {
                error: {
                    message: error.message,
                    name: error.name,
                    stack: error.stack
                }
            });
        } else if (error !== undefined) {
            this.logger.error(message, {
                error: String(error)
            });
        } else {
            this.logger.error(message);
        }
    }

    // Regular logging methods with proper typing
    public warn(message: string, metadata?: Record<string, any>): void {
        this.logger.warn(message, metadata);
    }

    public info(message: string, metadata?: Record<string, any>): void {
        this.logger.info(message, metadata);
    }

    public debug(message: string, metadata?: Record<string, any>): void {
        this.logger.debug(message, metadata);
    }

    // Set log level dynamically
    public setLevel(level: LogLevel): void {
        this.logger.level = level;
    }

    /**
     * Print to console with proper formatting
     * Use this instead of console.log for debug output
     */
    public print(message: string): void {
        if (process.env.NODE_ENV === 'development') {
            console.log(message);
        } else {
            this.info(message);
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