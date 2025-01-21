# API Documentation

## Core Services

### Phone Controller

```typescript
interface PhoneController {
    // Start the phone service
    start(): Promise<void>;
    
    // Stop the phone service
    stop(): Promise<void>;
    
    // Event listeners
    on(event: 'command', handler: (command: string) => void): void;
    on(event: 'dtmf', handler: (digit: string) => void): void;
    on(event: 'error', handler: (error: Error) => void): void;
}
```

### AI Service

```typescript
interface AIService {
    // Process text input
    processText(text: string): Promise<string>;
    
    // Generate speech
    generateSpeech(text: string): Promise<Buffer>;
    
    // Process voice input
    processVoice(audioBuffer: Buffer): Promise<string>;
}
```

### HomeKit Service

```typescript
interface HomeService {
    // Execute command
    executeCommand(command: string): Promise<void>;
    
    // Get device status
    getStatus(): Promise<object>;
    
    // Control specific device
    controlDevice(deviceId: string, command: string): Promise<void>;
}
```

## Event Types

### DTMF Events
```typescript
interface DTMFEvent {
    digit: string;        // Detected digit
    duration: number;     // Duration of tone
    timestamp: number;    // Detection timestamp
}
```

### Voice Events
```typescript
interface VoiceEvent {
    audio: Buffer;        // Audio data
    startTime: number;    // Start timestamp
    endTime: number;      // End timestamp
    isFinal: boolean;     // Is final segment
}
```

## Command Reference

### Music Controls
```typescript
// Play music
await musicService.play(query: string): Promise<void>;

// Pause music
await musicService.pause(): Promise<void>;

// Next/Previous track
await musicService.next(): Promise<void>;
await musicService.previous(): Promise<void>;
```

### HomeKit Controls
```typescript
// Toggle device
await homeService.toggle(deviceId: string): Promise<void>;

// Set device state
await homeService.setState(deviceId: string, state: object): Promise<void>;

// Activate scene
await homeService.activateScene(sceneId: string): Promise<void>;
```

## Error Handling

```typescript
try {
    await phoneController.start();
} catch (error) {
    if (error instanceof HardwareError) {
        // Handle hardware issues
    } else if (error instanceof APIError) {
        // Handle API issues
    }
}
```

## Configuration

```typescript
interface Config {
    audio: {
        sampleRate: number;
        channels: number;
        bitDepth: number;
    };
    ai: {
        model: string;
        temperature: number;
        maxTokens: number;
    };
    home: {
        bridgeName: string;
        port: number;
        pin: string;
    };
}
```

## Usage Examples

### Basic Setup
```typescript
const controller = new PhoneController(config);

controller.on('command', async (command) => {
    try {
        await handleCommand(command);
    } catch (error) {
        logger.error('Command error:', error);
    }
});

await controller.start();
```

### AI Integration
```typescript
const ai = new AIService(config);

// Process voice input
const response = await ai.processVoice(audioBuffer);

// Generate speech
const audio = await ai.generateSpeech(response);
```

### HomeKit Control
```typescript
const home = new HomeService(config);

// Toggle lights
await home.executeCommand('toggleLights');

// Set temperature
await home.setState('thermostat', { 
    temperature: 72 
});
```
