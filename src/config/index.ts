// src/config/index.ts
//
// Configuration manager that loads and validates system-wide settings.
// Handles configuration for DAHDI hardware, Home Assistant integration,
// and all other system components. Combines settings from environment 
// variables and config files with strong typing and validation.

import { z } from 'zod';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger';

// Load environment variables
dotenv.config();

// Configuration schema with DAHDI and Home Assistant support
const ConfigSchema = z.object({
    app: z.object({
        name: z.string().default('iroh'),
        env: z.enum(['development', 'production', 'test']).default('development'),
        port: z.number().default(3000),
    }),
    dahdi: z.object({
        device: z.string().default('/dev/dahdi/channel001'),
        span: z.number().default(1),
        channel: z.number().default(1),
        loadzone: z.string().default('us'),
        defaultzone: z.string().default('us'),
        echocancel: z.boolean().default(true),
        echocanceltaps: z.number().min(32).max(1024).default(128),
    }),
    audio: z.object({
        sampleRate: z.literal(8000), // DAHDI requires 8kHz
        channels: z.literal(1),      // DAHDI uses mono
        bitDepth: z.literal(16),     // DAHDI uses 16-bit PCM
        vadThreshold: z.number().min(0).max(1).default(0.3),
        silenceThreshold: z.number().min(100).max(2000).default(500),
    }),
    homeAssistant: z.object({
        url: z.string().url(),
        token: z.string(),
        entityPrefix: z.string().default('iroh_'),
        updateInterval: z.number().min(1000).default(5000),
        retryAttempts: z.number().min(1).default(3),
    }),
    ai: z.object({
        anthropicKey: z.string().optional(),
        elevenLabsKey: z.string().optional(),
        openAIKey: z.string().optional(),
        maxTokens: z.number().default(1024),
        temperature: z.number().default(0.7),
        voiceId: z.string().default('uncle-iroh'),
    }),
    logging: z.object({
        level: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
        directory: z.string().default('logs'),
        maxFiles: z.string().default('14d'),
        maxSize: z.string().default('20m'),
    }),
});

// Type inference from schema
type Config = z.infer<typeof ConfigSchema>;

function loadConfig(): Config {
    const env = process.env.NODE_ENV || 'development';
    const configDir = path.resolve(process.cwd(), 'config');

    try {
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
            dahdi: {
                ...config.dahdi,
                device: process.env.DAHDI_DEVICE,
                span: Number(process.env.DAHDI_SPAN),
                channel: Number(process.env.DAHDI_CHANNEL),
            },
            homeAssistant: {
                ...config.homeAssistant,
                url: process.env.HASS_URL,
                token: process.env.HASS_TOKEN,
            },
            ai: {
                ...config.ai,
                anthropicKey: process.env.ANTHROPIC_API_KEY,
                elevenLabsKey: process.env.ELEVENLABS_API_KEY,
                openAIKey: process.env.OPENAI_API_KEY,
            },
        };

        // Validate config
        const validatedConfig = ConfigSchema.parse(config);

        // Log configuration summary (excluding sensitive values)
        logger.info('Configuration loaded', {
            env,
            dahdiDevice: validatedConfig.dahdi.device,
            haUrl: validatedConfig.homeAssistant.url,
            logLevel: validatedConfig.logging.level,
        });

        return validatedConfig;
    } catch (error) {
        logger.error('Configuration validation failed:', error);
        throw error;
    }
}

// Export singleton instance
export const config = loadConfig();