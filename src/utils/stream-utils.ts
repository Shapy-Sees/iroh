// src/utils/stream-utils.ts
//
// Key Features:
// - Audio stream buffering
// - Backpressure handling
// - Stream transformation utilities
// - Memory usage optimization
// - Stream monitoring
//
// Usage:
// const buffer = new AudioStreamBuffer(config);
// buffer.write(audioChunk);
// buffer.on('full', processBuffer);

import { Transform, TransformOptions } from 'stream';

export class AudioStreamBuffer extends Transform {
    private buffer: Buffer[];
    private currentSize: number;
    private readonly maxSize: number;

    constructor(options: TransformOptions & { maxSize?: number }) {
        super(options);
        this.buffer = [];
        this.currentSize = 0;
        this.maxSize = options.maxSize || 1024 * 1024; // 1MB default
    }

    _transform(chunk: Buffer, encoding: string, callback: Function): void {
        this.currentSize += chunk.length;
        this.buffer.push(chunk);

        if (this.currentSize >= this.maxSize) {
            const completeBuffer = Buffer.concat(this.buffer);
            this.buffer = [];
            this.currentSize = 0;
            this.emit('full', completeBuffer);
        }

        callback();
    }

    _flush(callback: Function): void {
        if (this.buffer.length > 0) {
            const remainingBuffer = Buffer.concat(this.buffer);
            this.emit('full', remainingBuffer);
            this.buffer = [];
            this.currentSize = 0;
        }
        callback();
    }
}

export class StreamMonitor extends Transform {
    private bytesProcessed: number;
    private startTime: number;

    constructor(options: TransformOptions = {}) {
        super(options);
        this.bytesProcessed = 0;
        this.startTime = Date.now();
    }

    _transform(chunk: Buffer, encoding: string, callback: Function): void {
        this.bytesProcessed += chunk.length;
        
        const elapsed = (Date.now() - this.startTime) / 1000;
        const throughput = this.bytesProcessed / elapsed;

        this.emit('stats', {
            bytesProcessed: this.bytesProcessed,
            elapsed,
            throughput
        });

        this.push(chunk);
        callback();
    }
}