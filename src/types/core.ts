// src/types/core.ts

import { EventEmitter } from 'events';
import { Buffer } from 'buffer';

export interface PhoneControllerConfig {
  fxs: {
    devicePath: string;
    sampleRate: number;
  };
  audio: {
    bufferSize: number;
    channels: number;
    bitDepth: number;
  };
  ai: {
    model?: string;
    apiKey?: string;
  };
}

export interface DAHDIReadStream extends EventEmitter {
  read(size?: number): Buffer | null;
}
