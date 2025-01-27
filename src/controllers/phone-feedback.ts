import { AudioFormat } from '../types';

export class PhoneFeedback {
    private readonly audioFormat: AudioFormat = {
        sampleRate: 8000,
        channels: 1,
        bitDepth: 16,
        format: 'linear'
    };

    constructor(ai: IrohAIService, config?: Partial<FeedbackConfig>) {
        // ...existing code...
        this.audioConverter = new DAHDIAudioConverter({
            quality: process.env.NODE_ENV === 'production' ? 'best' : 'medium'
        });
    }

    private async generateSpeech(text: string): Promise<Buffer> {
        if (!this.config.enableVoice) {
            throw new Error('Voice feedback is disabled');
        }

        try {
            // Generate speech with DAHDI format requirements
            const audio = await this.ai.generateSpeech(text, {
                format: this.audioFormat
            });

            // Ensure DAHDI compatibility
            return await this.audioConverter.convertToDAHDI(audio);
        } catch (error) {
            logger.error('Failed to generate speech:', error);
            throw error;
        }
    }

    // ...existing code...
}
