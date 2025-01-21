import * as rpio from 'rpio';
import { logger } from '../utils/logger';

export class HardwareService {
    private initialized: boolean = false;

    constructor() {
        try {
            rpio.init({
                gpiomem: true,
                mapping: 'physical',
                mock: process.env.NODE_ENV === 'test'
            });
            this.initialized = true;
        } catch (error) {
            logger.error('Failed to initialize GPIO:', error);
            throw error;
        }
    }

    public setupPin(pin: number, direction: 'input' | 'output'): void {
        if (!this.initialized) throw new Error('Hardware service not initialized');
        
        rpio.open(pin, direction === 'input' ? rpio.INPUT : rpio.OUTPUT);
    }

    public writePin(pin: number, value: boolean): void {
        if (!this.initialized) throw new Error('Hardware service not initialized');
        
        rpio.write(pin, value ? rpio.HIGH : rpio.LOW);
    }

    public readPin(pin: number): boolean {
        if (!this.initialized) throw new Error('Hardware service not initialized');
        
        return rpio.read(pin) === rpio.HIGH;
    }

    public cleanup(): void {
        Object.keys(rpio).forEach(pin => {
            try {
                rpio.close(parseInt(pin));
            } catch (error) {
                logger.error(`Failed to cleanup pin ${pin}:`, error);
            }
        });
    }
}
