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
    ErrorLogMetadata,
    BaseLogMetadata,
    LogComponent,
    ErrorSeverity,
    LogMetadataType
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

    public error(message: string, metadata: Partial<ErrorLogMetadata>): void {
        const enrichedMetadata = this.enrichMetadata('error', metadata) as ErrorLogMetadata;
        if (!validateMetadata(enrichedMetadata)) {
            console.error('Invalid error metadata:', enrichedMetadata);
            this.logger.error(message);
            return;
        }
        this.logger.error(message, enrichedMetadata);
    }

    public warn(message: string, metadata?: Partial<LogMetadata>): void {
        const enrichedMetadata = this.enrichMetadata('warn', metadata);
        if (validateMetadata(enrichedMetadata)) {
            this.logger.warn(message, enrichedMetadata);
        }
    }

    public info(message: string, metadata?: Partial<LogMetadata>): void {
        const enrichedMetadata = this.enrichMetadata('info', metadata);
        if (validateMetadata(enrichedMetadata)) {
            this.logger.info(message, enrichedMetadata);
        }
    }

    public debug(message: string, metadata?: Partial<LogMetadata>): void {
        const enrichedMetadata = this.enrichMetadata('debug', metadata);
        if (validateMetadata(enrichedMetadata)) {
            this.logger.debug(message, enrichedMetadata);
        }
    }

    private enrichMetadata(level: LogLevel, metadata?: Partial<LogMetadata>): LogMetadata {
        const baseMetadata: BaseLogMetadata = {
            timestamp: new Date().toISOString(),
            component: metadata?.component || 'system',
            type: metadata?.type || 'error',
            context: {
                nodeEnv: process.env.NODE_ENV,
                hostname: require('os').hostname(),
                pid: process.pid,
                ...metadata?.context
            },
            details: metadata?.details,
            severity: metadata?.severity
        };

        let enriched: LogMetadata;

        switch (metadata?.type) {
            case 'error':
                enriched = this.enrichErrorMetadata(baseMetadata, metadata as Partial<ErrorLogMetadata>);
                break;
            case 'hardware':
                enriched = this.enrichHardwareMetadata(baseMetadata, metadata as Partial<HardwareLogMetadata>);
                break;
            // ...handle other types similarly...
            default:
                enriched = { ...baseMetadata, type: 'error' } as ErrorLogMetadata;
        }

        return enriched;
    }

    private enrichErrorMetadata(
        base: BaseLogMetadata, 
        metadata?: Partial<ErrorLogMetadata>
    ): ErrorLogMetadata {
        const error = metadata?.error instanceof Error ? {
            message: metadata.error.message,
            name: metadata.error.name,
            stack: metadata.error.stack,
            code: (metadata.error as any).code
        } : metadata?.error || {
            message: 'Unknown error',
            name: 'Error'
        };

        return {
            ...base,
            type: 'error',
            error,
            severity: metadata?.severity || ErrorSeverity.MEDIUM,
            context: {
                ...base.context,
                errorCode: error.code,
                errorType: error.name
            }
        };
    }

    private enrichHardwareMetadata(
        base: Partial<BaseLogMetadata>,
        metadata: Partial<HardwareLogMetadata>
    ): HardwareLogMetadata {
        return {
            ...base,
            type: 'hardware',
            component: 'hardware',
            deviceId: metadata.deviceId || 'unknown',
            status: metadata.status,
            metrics: metadata.metrics
        } as HardwareLogMetadata;
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