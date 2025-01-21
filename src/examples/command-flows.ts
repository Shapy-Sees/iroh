// src/examples/command-flows.ts
//
// Key Features:
// - Complete command flow examples
// - DTMF and voice command handling
// - Error handling and recovery
// - Feedback processing
// - State updates
// - Service coordination

import { PhoneController } from '../controllers/phone-controller';
import { ServiceManager } from '../services/service-manager';
import { logger } from '../utils/logger';

// Example 1: DTMF Command Flow - "*1" to turn off all lights
async function handleDTMFCommand(phone: PhoneController, services: ServiceManager) {
    // 1. Phone receives DTMF input "*1"
    phone.on('dtmf', async (event) => {
        logger.debug('DTMF received:', event.digit);
        
        if (event.digit === '*') {
            // Start special command mode
            phone.startSpecialCommand();
        } else if (phone.isSpecialCommand && event.digit === '1') {
            // Execute "all lights off" command
            try {
                // Play acknowledgment tone
                await phone.playFeedbackTone('confirm');

                // Process command through service manager
                await services.handleCommand('turn off all lights');

                // Generate voice confirmation
                const response = await services.ai.processText(
                    "I've turned off all the lights. Is there anything else you need?"
                );
                const speech = await services.ai.generateSpeech(response);
                await phone.playAudio(speech);

            } catch (error) {
                logger.error('Error executing all lights off command:', error);
                await phone.playFeedbackTone('error');
            }
        }
    });
}

// Example 2: Voice Command Flow - "Play jazz music in the living room"
async function handleVoiceCommand(phone: PhoneController, services: ServiceManager) {
    phone.on('voice', async (event) => {
        try {
            logger.debug('Voice command received');

            // 1. Convert speech to text
            const text = await services.ai.processVoice(event.audio);
            logger.debug('Speech converted to:', text);

            // 2. Parse intent
            if (text.toLowerCase().includes('play') && text.toLowerCase().includes('jazz')) {
                // 3. Handle music command
                await services.music.executeCommand({
                    action: 'play',
                    query: 'jazz',
                    location: 'living room'
                });

                // 4. Generate confirmation
                const response = await services.ai.processText(
                    "I've started playing jazz music in the living room. The current playlist is 'Jazz Essentials'. Would you like me to adjust the volume?"
                );
                
                // 5. Convert response to speech
                const speech = await services.ai.generateSpeech(response);

                // 6. Play response
                await phone.playAudio(speech);

                // 7. Update AI context with new state
                await services.updateAIContext('musicState', {
                    playing: true,
                    genre: 'jazz',
                    location: 'living room',
                    volume: 50
                });
            }
        } catch (error) {
            logger.error('Error handling voice command:', error);
            const errorSpeech = await services.ai.generateSpeech(
                "I apologize, but I couldn't process that request. Would you mind trying again?"
            );
            await phone.playAudio(errorSpeech);
        }
    });
}

// Example 3: Complex Command Flow - "Good Morning" routine
async function handleMorningRoutine(phone: PhoneController, services: ServiceManager) {
    // Triggered by DTMF "*4"
    phone.on('command', async (sequence) => {
        if (sequence === '*4') {
            try {
                logger.info('Executing morning routine');
                await phone.playFeedbackTone('confirm');

                // 1. Turn on lights gradually
                await services.home.executeCommand({
                    action: 'scene',
                    name: 'morning_lights',
                    transition: 30 // 30 seconds fade in
                });

                // 2. Adjust temperature
                await services.home.executeCommand({
                    action: 'temperature',
                    value: 72
                });

                // 3. Start morning playlist
                await services.music.executeCommand({
                    action: 'play',
                    playlist: 'Morning Coffee',
                    volume: 30
                });

                // 4. Get weather report
                const weather = await services.ai.processText('What\'s today\'s weather?');
                
                // 5. Generate morning greeting
                const greeting = await services.ai.processText(
                    `Good morning! ${weather} I've turned on the lights, set the temperature to 72°F, and started your morning playlist. Would you like me to start brewing your tea?`
                );

                // 6. Convert to speech and play
                const speech = await services.ai.generateSpeech(greeting);
                await phone.playAudio(speech);

                // 7. Update system state
                await services.updateSystemState({
                    morningRoutine: {
                        executed: true,
                        timestamp: new Date().toISOString()
                    }
                });

            } catch (error) {
                logger.error('Error executing morning routine:', error);
                const errorMessage = await services.ai.generateSpeech(
                    "I encountered an issue while setting up your morning routine. Some features may not be working as expected. Would you like me to try again?"
                );
                await phone.playAudio(errorMessage);
            }
        }
    });
}

// Example 4: Error Recovery Flow
async function handleErrorRecovery(phone: PhoneController, services: ServiceManager) {
    services.on('error', async (error) => {
        logger.error('Service error:', error);

        try {
            // 1. Determine error type and severity
            const severity = error.code === 'HARDWARE_ERROR' ? 'critical' : 'normal';

            // 2. Generate appropriate response
            let response: string;
            if (severity === 'critical') {
                response = "I'm having trouble with the home automation system. I'll need a moment to reset. Please try your command again in a few seconds.";
                await services.home.restart();
            } else {
                response = "I didn't quite catch that. Could you please repeat your command?";
            }

            // 3. Convert to speech and play
            const speech = await services.ai.generateSpeech(response);
            await phone.playAudio(speech);

            // 4. Log recovery attempt
            logger.info('Error recovery completed', { severity, error });

        } catch (recoveryError) {
            logger.error('Error recovery failed:', recoveryError);
            await phone.playFeedbackTone('error');
        }
    });
}