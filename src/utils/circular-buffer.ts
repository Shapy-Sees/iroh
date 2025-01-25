// src/utils/circular-buffer.ts
// Circular buffer implementation for audio processing

import { logger } from './logger';

export class CircularBuffer {
    private buffer: Buffer;
    private writePos: number = 0;
    private readPos: number = 0;
    private available: number = 0;

    constructor(private readonly size: number) {
        this.buffer = Buffer.alloc(size);
        logger.debug('Created circular buffer', { size });
    }

    public write(data: Buffer): number {
        const bytesToWrite = Math.min(data.length, this.size - this.available);
        if (bytesToWrite === 0) {
            logger.warn('Buffer full, dropping data');
            return 0;
        }

        // Write in two parts if wrapping around buffer end
        const firstPart = Math.min(bytesToWrite, this.size - this.writePos);
        data.copy(this.buffer, this.writePos, 0, firstPart);
        
        if (bytesToWrite > firstPart) {
            data.copy(this.buffer, 0, firstPart, bytesToWrite);
        }

        this.writePos = (this.writePos + bytesToWrite) % this.size;
        this.available += bytesToWrite;

        return bytesToWrite;
    }

    public read(length: number): Buffer {
        const bytesToRead = Math.min(length, this.available);
        if (bytesToRead === 0) {
            return Buffer.alloc(0);
        }

        const result = Buffer.alloc(bytesToRead);
        
        // Read in two parts if wrapping around buffer end
        const firstPart = Math.min(bytesToRead, this.size - this.readPos);
        this.buffer.copy(result, 0, this.readPos, this.readPos + firstPart);
        
        if (bytesToRead > firstPart) {
            this.buffer.copy(result, firstPart, 0, bytesToRead - firstPart);
        }

        this.readPos = (this.readPos + bytesToRead) % this.size;
        this.available -= bytesToRead;

        return result;
    }

    public clear(): void {
        this.writePos = 0;
        this.readPos = 0;
        this.available = 0;
        logger.debug('Circular buffer cleared');
    }

    public getAvailable(): number {
        return this.available;
    }
}