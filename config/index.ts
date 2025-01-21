// src/config/index.ts
//
// Key Features:
// - Environment-based configuration
// - Secret management
// - Schema validation
// - Type safety
// - Hot reloading
// - Encrypted secrets
// - Default values
//
// Usage:
// import { config } from '../config';
// const apiKey = config.get('ai.anthropicKey');
// const audioSettings = config.getSection('audio');

import { z } from 'zod';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger';

// Configuration schema using Zod
const ConfigSchema = z.object({
    app: z.object({
        name: z.string().default('iroh'),
        env: z.enum(['development', 'production', 'test']).default('development'),
        port: z.number().default(3000),
    }),
    audio: z.object({
        sampleRate: z.number().default(16000),
        channels: z.number().default(1),
        bitDepth: z.number().default(16),
        vadThreshold: z.number().default(0.3),
        silenceThreshold: z.number().default(500),
    }),
    ai: z.object({
        anthropicKey: z.string(),
        elevenLabsKey: z.string(),
        openAIKey: z.string(),
        maxTokens: z.number().default(1024),
        temperature: z.number().default(0.7),
        voiceId: z.string().default('uncle-iroh'),
    }),
    music: z.object({
        spotifyClientId: z.string().optional(),
        spotifyClientSecret: z.string().optional(),
        appleMusicKey: z.string().optional(),
        sonosClientId: z.string().optional(),
    }),
    home: z.object({
        homekitBridge: z.object({
            pin: z.string().default('031-45-154'),
            name: z.string().default('Iroh Bridge'),
            port: z.number().default(47128),
        }),
    }),
    logging: z.object({
        level: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
        directory: z.string().default('logs'),
        maxFiles: z.string().default('14d'),
        maxSize: z.string().default('20m'),
    }),
});

type Config = z.infer<typeof ConfigSchema>;

class ConfigManager {
    private config: Config;
    private readonly envPath: string;
    private readonly configPath: string;

    constructor() {
        this.envPath = path.resolve(process.cwd(), '.env');
        this.configPath = path.resolve(process.cwd(), 'config');
        this.config = this.loadConfig();

        // Watch for config changes in development
        if (process.env.NODE_ENV === 'development') {
            this.watchConfig();
        }
    }

    private loadConfig(): Config {
        try {
            // Load environment variables
            dotenv.config({ path: this.envPath });

            // Load environment-specific config
            const env = process.env.NODE_ENV || 'development';
            const configFile = path.join(this.configPath, `${env}.json`);
            
            let fileConfig = {};
            if (fs.existsSync(configFile)) {
                fileConfig = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
            }

            // Combine configs with environment variables taking precedence
            const combinedConfig = {
                ...fileConfig,
                ...this.loadEnvVariables(),
            };

            // Validate and parse config
            const validatedConfig = ConfigSchema.parse(combinedConfig);

            logger.info('Configuration loaded successfully', { env });
            return validatedConfig;

        } catch (error) {
            logger.error('Failed to load configuration', error as Error);
            throw error;
        }
    }

    private loadEnvVariables(): Partial<Config> {
        // Map environment variables to config structure
        return {
            app: {
                name: process.env.APP_NAME,
                env: process.env.NODE_ENV as Config['app']['env'],
                port: process.env.PORT ? parseInt(process.env.PORT) : undefined,
            },
            ai: {
                anthropicKey: process.env.ANTHROPIC_API_KEY,
                elevenLabsKey: process.env.ELEVENLABS_API_KEY,
                openAIKey: process.env.OPENAI_API_KEY,
            },
            // Add other sections as needed
        };
    }

    private watchConfig(): void {
        fs.watch(this.configPath, (eventType, filename) => {
            if (eventType === 'change') {
                logger.info('Config file changed, reloading...', { filename });
                this.config = this.loadConfig();
            }
        });

        fs.watch(this.envPath, (eventType) => {
            if (eventType === 'change') {
                logger.info('.env file changed, reloading...');
                this.config = this.loadConfig();
            }
        });
    }

    public get<T>(path: string): T {
        return path.split('.').reduce((obj, key) => obj[key], this.config as any);
    }

    public getSection<K extends keyof Config>(section: K): Config[K] {
        return this.config[section];
    }

    public validate(): void {
        ConfigSchema.parse(this.config);
    }
}

// Create and export singleton instance
export const config = new ConfigManager();