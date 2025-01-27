// src/utils/logger.ts
//
// Enhanced logging system that provides structured logging with type safety.
// Supports multiple log levels, file rotation, and proper error handling.

import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';
import fs from 'fs';
import { 
    LogLevel, 
    LogMetadata, 
    LoggerConfig,
    createLogMetadata,
    validateMetadata,
    LogEntry,
    isErrorMetadata,
    isHardwareMetadata,
    isAudioMetadata,
    isServiceMetadata,
    isCommandMetadata,
    isStateMetadata
} from '../types/logging';

export class Logger {
    private logger: winston.Logger;
    private readonly logDir: string;
    private level: LogLevel;

    constructor(config?: Partial<LoggerConfig>) {
        // Set default configuration
        const defaultConfig: LoggerConfig = {
            level: 'info',
            directory: 'logs',
            maxFiles: '14d',
            maxSize: '20m',
            console: process.env.NODE_ENV === 'development',
            timestamps: true,
            format: {
                colors: true,
                json: false,
                prettyPrint: process.env.NODE_ENV === 'development'
            }
        };

        const finalConfig = { ...defaultConfig, ...config };
        this.level = finalConfig.level;
        this.logDir = path.join(process.cwd(), finalConfig.directory);
        
        this.ensureLogDirectory();
        this.logger = this.initializeLogger(finalConfig);
    }

    private ensureLogDirectory(): void {
        if (!fs.existsSync(this.logDir)) {
            fs.mkdirSync(this.logDir, { recursive: true });
        }
    }

    private initializeLogger(config: LoggerConfig): winston.Logger {
        const formats = [
            winston.format.timestamp(),
            winston.format.errors({ stack: true }),
            config.format?.json ? winston.format.json() : winston.format.simple()
        ];

        if (config.format?.colors) {
            formats.unshift(winston.format.colorize());
        }

        const transports: winston.transport[] = [
            new DailyRotateFile({
                dirname: this.logDir,
                filename: 'iroh-%DATE%.log',
                datePattern: 'YYYY-MM-DD',
                maxSize: config.maxSize,
                maxFiles: config.maxFiles,
                format: winston.format.combine(...formats)
            })
        ];

        if (config.console) {
            transports.push(
                new winston.transports.Console({
                    format: winston.format.combine(
                        winston.format.colorize(),
                        winston.format.simple()
                    )
                })
            );
        }

        return winston.createLogger({
            level: config.level,
            format: winston.format.combine(...formats),
            transports
        });
    }

    public error(message: string, metadata?: Partial<LogMetadata>): void {
        const enrichedMetadata = this.enrichMetadata('error', metadata);
        if (!validateMetadata(enrichedMetadata)) {
            console.error('Invalid log metadata:', enrichedMetadata);
            this.logger.error(message);
            return;
        }
        this.logger.error(message, enrichedMetadata);
    }

    public warn(message: string, metadata?: LogMetadata): void {
        const enrichedMetadata = this.enrichMetadata('warn', metadata);
        this.logger.warn(message, enrichedMetadata);
    }

    public info(message: string, metadata?: LogMetadata): void {
        const enrichedMetadata = this.enrichMetadata('info', metadata);
        this.logger.info(message, enrichedMetadata);
    }

    public debug(message: string, metadata?: LogMetadata): void {
        const enrichedMetadata = this.enrichMetadata('debug', metadata);
        this.logger.debug(message, enrichedMetadata);
    }

    private enrichMetadata(level: LogLevel, metadata?: Partial<LogMetadata>): LogMetadata {
        if (!metadata?.component) {
            metadata = { ...metadata, component: 'system' };
        }

        const enriched = {
            timestamp: new Date().toISOString(),
            ...metadata,
            context: {
                nodeEnv: process.env.NODE_ENV,
                ...metadata?.context
            }
        } as LogMetadata;

        // Add type-specific enrichments
        if (isErrorMetadata(enriched)) {
            this.enrichErrorMetadata(enriched);
        } else if (isHardwareMetadata(enriched)) {
            this.enrichHardwareMetadata(enriched);
        } else if (isAudioMetadata(enriched)) {
            this.enrichAudioMetadata(enriched);
        } else if (isServiceMetadata(enriched)) {
            this.enrichServiceMetadata(enriched);
        } else if (isCommandMetadata(enriched)) {
            this.enrichCommandMetadata(enriched);
        } else if (isStateMetadata(enriched)) {
            this.enrichStateMetadata(enriched);
        }

        return enriched;
    }

    private enrichErrorMetadata(metadata: ErrorLogMetadata): void {
        if (metadata.error && metadata.error instanceof Error) {
            const errorObj = {
                message: metadata.error.message,
                name: metadata.error.name,
                stack: metadata.error.stack,
                code: (metadata.error as any).code
            };

            metadata.error = errorObj;
            metadata.severity = metadata.severity || ErrorSeverity.MEDIUM;
        }
    }

    private enrichHardwareMetadata(metadata: HardwareLogMetadata): void {
        // Add any hardware-specific enrichments
    }

    private enrichAudioMetadata(metadata: AudioLogMetadata): void {
        // Add any audio-specific enrichments
    }

    private enrichServiceMetadata(metadata: ServiceLogMetadata): void {
        // Add any service-specific enrichments
    }

    private enrichCommandMetadata(metadata: CommandLogMetadata): void {
        // Add any command-specific enrichments
    }

    private enrichStateMetadata(metadata: StateLogMetadata): void {
        // Add any state-specific enrichments
    }

    public setLevel(level: LogLevel): void {
        this.level = level;
        this.logger.level = level;
    }

    public getLevel(): LogLevel {
        return this.level;
    }

    /**
     * Print to console with proper formatting in development
     */
    public print(message: string, metadata?: LogMetadata): void {
        if (process.env.NODE_ENV === 'development') {
            console.log(message);
        } else {
            this.info(message, metadata);
        }
    }

    /**
     * Print to console with proper formatting and preserve newlines
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