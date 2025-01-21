# Command Reference

## Phone Commands

### Single Digit Commands

| Digit | Command | Description |
|-------|---------|-------------|
| 1 | Toggle Main Lights | Toggles the main room lights |
| 2 | Music Control | Start/Stop music playback |
| 3 | Weather Report | Get current weather information |
| 4 | Volume Up | Increase audio volume |
| 5 | Volume Down | Decrease audio volume |
| 6 | Next Track | Skip to next music track |
| 7 | Previous Track | Go to previous track |
| 8 | Status Report | Get system status update |
| 9 | Help Menu | List available commands |
| 0 | Cancel | Cancel current operation |

### Special Commands

| Sequence | Command | Description |
|----------|---------|-------------|
| *1 | All Lights Off | Turn off all lights |
| *2 | Away Mode | Enable away mode |
| *3 | Movie Mode | Set up movie scene |
| *4 | Good Morning | Activate morning routine |
| *5 | Good Night | Activate night routine |
| #1 | Emergency Mode | Activate emergency lights |
| #2 | Reset System | Reset all settings |
| #3 | System Status | Detailed system report |

## Voice Commands

### Music Control
```
"Play [artist/song/playlist]"
"Pause music"
"Next song"
"Previous song"
"Volume up/down"
"Shuffle playlist"
```

### Home Control
```
"Turn on/off [device]"
"Set [device] to [state]"
"Activate [scene]"
"Set temperature to [value]"
```

### Information
```
"What's the weather?"
"How are my devices?"
"System status"
"List commands"
```

## Command Modifiers

### Duration Modifiers
- "for 10 minutes"
- "until sunset"
- "for one hour"

### Location Modifiers
- "in the living room"
- "upstairs"
- "everywhere"

### State Modifiers
- "to 50 percent"
- "to warm white"
- "to blue"

## Response Feedback

### Audio Feedback
- Single beep: Command acknowledged
- Double beep: Command completed
- Triple beep: Error
- Long tone: System busy

### Voice Feedback
- Command confirmation
- Error explanation
- Status updates
- Help information

## Error Recovery

### Common Issues
1. Unrecognized command
   - System will ask for clarification
   - Suggest similar commands

2. Hardware errors
   - System will provide diagnostic info
   - Suggest troubleshooting steps

3. Service unavailable
   - System will explain the issue
   - Provide alternative options

### Recovery Commands
```
"Cancel" - Stop current operation
"Help" - Get assistance
"Repeat" - Repeat last action
"Status" - Check system state
```

## Advanced Features

### Command Chaining
- "Turn on lights and play music"
- "Set movie mode and dim lights"

### Conditional Commands
- "If motion detected then turn on lights"
- "When temperature above 75 then start fan"

### Scheduled Commands
- "Turn off lights in 30 minutes"
- "Start music at 8 AM"

## Safety Features

### Emergency Override
- "#1" immediately activates emergency mode
- Voice command "Emergency" does the same

### System Protection
- Confirmation required for critical commands
- Automatic timeout for potentially dangerous states

## Adding Custom Commands

### DTMF Commands
```typescript
phoneController.addCommand({
    sequence: '42',
    description: 'Custom action',
    handler: async () => {
        // Implementation
    }
});
```

### Voice Commands
```typescript
aiService.addCommand({
    trigger: 'custom action',