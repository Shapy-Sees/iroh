// src/config/index.ts
//
// Description:
// Configuration loader that combines config files and environment variables.
// Provides type-safe access to configuration values.

import { z } from 'zod';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger';

// Load environment variables
dotenv.config();

// Configuration schema
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
        anthropicKey: z.string().optional(),
        elevenLabsKey: z.string().optional(),
        openAIKey: z.string().optional(),
        maxTokens: z.number().default(1024),
        temperature: z.number().default(0.7),
        voiceId: z.string().default('uncle-iroh'),
    }),
    timer: z.object({
        devicePath: z.string().default('/dev/ttyUSB1'),
        baudRate: z.number().default(9600),
        maxTimers: z.number().default(5),
        maxDuration: z.number().default(180),
    }),
    logging: z.object({
        level: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
        directory: z.string().default('logs'),
        maxFiles: z.string().default('14d'),
        maxSize: z.string().default('20m'),
    }),
});

type Config = z.infer<typeof ConfigSchema>;

function loadConfig(): Config {
    const env = process.env.NODE_ENV || 'development';
    const configDir = path.resolve(process.cwd(), 'config');

    // Load default config
    let config = {};
    const defaultConfigPath = path.join(configDir, 'default.json');
    if (fs.existsSync(defaultConfigPath)) {
        config = JSON.parse(fs.readFileSync(defaultConfigPath, 'utf-8'));
    }

    // Load environment-specific config
    const envConfigPath = path.join(configDir, `${env}.json`);
    if (fs.existsSync(envConfigPath)) {
        const envConfig = JSON.parse(fs.readFileSync(envConfigPath, 'utf-8'));
        config = { ...config, ...envConfig };
    }

    // Add environment variables
    config = {
        ...config,
        ai: {
            ...config.ai,
            anthropicKey: process.env.ANTHROPIC_API_KEY,
            elevenLabsKey: process.env.ELEVENLABS_API_KEY,
            openAIKey: process.env.OPENAI_API_KEY,
        },
    };

    // Validate config
    try {
        return ConfigSchema.parse(config);
    } catch (error) {
        logger.error('Configuration validation failed:', error);
        throw error;
    }
}

export const config = loadConfig();