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
import { ConfigurationError, ServiceConfig } from '../types/core';

// Load environment variables
dotenv.config();

// Audio format schema
const AudioFormatSchema = z.object({
  sampleRate: z.number().default(8000),
  channels: z.number().default(1),
  bitDepth: z.number().default(16),
  format: z.enum(['linear', 'alaw', 'ulaw']).default('linear')
});

// Configuration schema with type validation
const ConfigSchema = z.object({
    app: z.object({
        name: z.string().default('iroh'),
        env: z.enum(['development', 'production', 'test']).default('development'),
        port: z.number().default(3000),
    }),
    hardware: z.object({
        dahdi: z.object({
            devicePath: z.string().default('/dev/dahdi/channel001'),
            audioFormat: AudioFormatSchema,
            sampleRate: z.literal(8000),
            channel: z.object({
                number: z.number().min(1).default(1),
                ringCadence: z.tuple([z.number(), z.number()]).default([2000, 4000]),
                callerIdFormat: z.enum(['bell', 'v23', 'dtmf']).default('bell'),
                impedance: z.union([z.literal(600), z.literal(900)]).default(600),
                gain: z.object({
                    rx: z.number().default(0),
                    tx: z.number().default(0),
                }),
            }),
            audio: z.object({
                echoCancellation: z.object({
                    enabled: z.boolean().default(true),
                    taps: z.number().min(32).max(1024).default(128),
                    nlp: z.boolean().default(true),
                }),
                gainControl: z.object({
                    enabled: z.boolean().default(true),
                    targetLevel: z.number().default(-15),
                    maxGain: z.number().default(12),
                }),
                dtmfDetection: z.object({
                    useHardware: z.boolean().default(true),
                    minDuration: z.number().default(40),
                    threshold: z.number().default(0.25),
                }),
            }),
            debug: z.object({
                logHardware: z.boolean().default(false),
                logAudio: z.boolean().default(false),
                traceDahdi: z.boolean().default(false),
            }).default({}),
        }),
        audio: AudioFormatSchema.extend({
            vadThreshold: z.number().min(0).max(1).default(0.3),
            silenceThreshold: z.number().min(100).max(2000).default(500),
        }),
    }),
    services: z.object({
        ai: z.object({
            anthropicKey: z.string().min(1),
            elevenLabsKey: z.string().optional(),
            maxTokens: z.number().default(1024),
            temperature: z.number().default(0.7),
            voiceId: z.string().optional(),
        }),
        home: z.object({
            url: z.string().url(),
            token: z.string().min(1),
            entityPrefix: z.string().default('iroh_'),
            updateInterval: z.number().default(5000),
        }),
        music: z.object({
            spotifyClientId: z.string().optional(),
            spotifyClientSecret: z.string().optional(),
            defaultVolume: z.number().default(50),
        }),
        timer: z.object({
            maxTimers: z.number().default(10),
            maxDuration: z.number().default(3600),
        }),
        hardware: z.object({
            bufferSize: z.number().default(1024),
            enableEchoCancellation: z.boolean().default(true),
        }),
    }),
    logging: z.object({
        level: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
        directory: z.string().default('logs'),
        maxFiles: z.string().default('14d'),
        maxSize: z.string().default('20m'),
    }),
});

// Type inference from schema
export type AudioFormat = z.infer<typeof AudioFormatSchema>;
export type Config = z.infer<typeof ConfigSchema>;

function loadConfig(): ServiceConfig {
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
        const envConfig = {
            app: {
                env: process.env.NODE_ENV,
                port: process.env.PORT ? parseInt(process.env.PORT, 10) : undefined,
            },
            services: {
                ai: {
                    anthropicKey: process.env.ANTHROPIC_API_KEY,
                    elevenLabsKey: process.env.ELEVENLABS_API_KEY,
                },
                home: {
                    url: process.env.HASS_URL,
                    token: process.env.HASS_TOKEN,
                },
                music: {
                    spotifyClientId: process.env.SPOTIFY_CLIENT_ID,
                    spotifyClientSecret: process.env.SPOTIFY_CLIENT_SECRET,
                },
            },
        };

        // Merge configs with proper precedence
        const mergedConfig = deepMerge(
            defaultConfig,
            environmentConfig,
            envConfig
        );

        // Validate merged config
        const validatedConfig = ConfigSchema.parse(mergedConfig);

        // Remove sensitive data before logging
        const sanitizedConfig = sanitizeConfig(validatedConfig);
        logger.info('Configuration loaded', sanitizedConfig);

        return validatedConfig;
    } catch (error) {
        logger.error('Configuration validation failed:', error);
        throw error;
    }
}

// Helper to remove sensitive data for logging
function sanitizeConfig(config: Config): Partial<Config> {
    const sanitized = { ...config };
    if (sanitized.services?.ai) {
        sanitized.services.ai = { ...sanitized.services.ai, anthropicKey: '***', elevenLabsKey: '***' };
    }
    if (sanitized.services?.home) {
        sanitized.services.home = { ...sanitized.services.home, token: '***' };
    }
    if (sanitized.services?.music) {
        sanitized.services.music = { ...sanitized.services.music, spotifyClientSecret: '***' };
    }
    return sanitized;
}

// Export typed config instance
export const config: ServiceConfig = loadConfig();