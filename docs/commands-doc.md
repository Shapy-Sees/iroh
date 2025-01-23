# Iroh Command Reference Guide

This document provides a comprehensive guide to Iroh's command system, covering both DTMF (touch-tone) commands and voice commands. Each command is designed to feel natural and intuitive, whether using the telephone keypad or speaking directly.

## Command Philosophy

Our command structure follows Uncle Iroh's principles of clarity and wisdom. Every command should be:
- Simple to remember and execute
- Forgiving of minor variations
- Clear in its feedback
- Safe to explore and experiment with

## DTMF Commands

DTMF commands use the telephone keypad for precise control. Commands generally follow this pattern:
`*[category][action][parameter]#`

The `*` indicates the start of a command, and `#` confirms execution.

### Quick Reference

#### Basic Controls
- `*1` - Toggle all lights
- `*10[1-9]` - Set light brightness (1-9 = 10%-90%, 0 = 100%)
- `*11[room]` - Toggle lights in specific room
- `*2` - Start/stop music
- `*20[1-9]` - Set volume level
- `*21` - Next track
- `*22` - Previous track
- `*3[temp]#` - Set temperature (e.g. *372# = 72°F)
- `*4` - Start morning routine
- `*5` - Start evening routine

#### Information
- `*61` - Weather report
- `*62` - Time and date
- `*63` - System status
- `*64` - Last command history

#### Timer Control
- `*7[minutes]#` - Set timer (e.g. *715# = 15 minute timer)
- `*70` - Cancel current timer
- `*71` - Check timer status

#### System Control
- `*90` - Help menu (spoken guide to commands)
- `*91` - Repeat last response
- `*99` - System reset

### Extended Command Details

1. Light Control Commands
   ```
   *1         - Toggle all lights
   *10[level] - Set main lights brightness
   *11[room]  - Toggle room lights where:
                1 = Living Room
                2 = Kitchen
                3 = Bedroom
                4 = Office
   *12[room][level] - Set room brightness
   ```

2. Music Control Commands
   ```
   *2        - Play/pause music
   *20[level] - Set volume (0-9)
   *21       - Next track
   *22       - Previous track
   *23[genre] - Play genre where:
                1 = Jazz
                2 = Classical
                3 = Rock
                4 = Electronic
   ```

## Voice Commands

Voice commands are designed to feel like natural conversation. The system understands various phrasings and can extract intent from casual speech.

### Basic Command Structure

Most voice commands follow this natural pattern:
`[Action] [Target] [Parameter]`

Examples:
- "Turn on the living room lights"
- "Set the temperature to 72 degrees"
- "Play some jazz music"

### Command Categories

1. Lighting Control
   ```
   "Turn on/off the lights"
   "Dim the lights to 50 percent"
   "Make the kitchen brighter"
   "Set living room lights to cozy"
   ```

2. Climate Control
   ```
   "Set temperature to 72 degrees"
   "Make it a bit warmer"
   "Turn on the fan"
   "What's the current temperature?"
   ```

3. Music Control
   ```
   "Play some relaxing music"
   "Skip this song"
   "Turn up the volume"
   "What's playing right now?"
   ```

4. Information Queries
   ```
   "What's the weather like?"
   "What time is it?"
   "How much longer on the timer?"
   "What's on my calendar today?"
   ```

5. Scene Control
   ```
   "Start morning routine"
   "Set up movie mode"
   "Good night" (triggers evening routine)
   "I'm home" (triggers welcome scene)
   ```

## Command Feedback

The system provides feedback through:
1. Success/Acknowledgment Tones
   - Short high tone: Command accepted
   - Double tone: Command completed
   - Low tone: Command error

2. Voice Responses
   - Confirms command understanding
   - Provides status updates
   - Offers suggestions when commands are unclear
   - Asks for clarification when needed

3. Error Handling
   - Clear explanation of what went wrong
   - Suggestions for correct command usage
   - Option to retry or modify command

## Safety and Security

1. Protected Commands
   Some commands require confirmation to execute:
   ```
   - System reset (*99)
   - All device power off
   - Temperature changes > 5 degrees
   ```

2. Command Timeouts
   - DTMF commands must complete within 5 seconds
   - Voice commands have a 10-second listening window
   - System will prompt for continuation on timeout

3. Command Limits
   - Maximum 3 failed attempts before temporary lockout
   - Rate limiting on rapid command sequences
   - Automatic safety checks on environmental controls

## Developer Notes

When implementing command handlers:
1. Always validate input ranges
2. Provide immediate feedback
3. Log all command attempts
4. Implement graceful failure modes
5. Consider command queueing for complex operations

Example command handler structure:
```typescript
interface CommandHandler {
  validate(): boolean;
  execute(): Promise<void>;
  provideFeedback(): Promise<void>;
  handleError(error: Error): Promise<void>;
}
```

## Customization

The command system can be extended through:
1. Custom DTMF sequences
2. Voice command aliases
3. Scene definitions
4. Routine configurations
5. Room and device mappings

Configuration is stored in `commands.yaml`:
```yaml
commands:
  dtmf:
    custom_sequences:
      # Add custom DTMF commands
  voice:
    aliases:
      # Add alternative voice command phrases
  rooms:
    # Define room mappings
  scenes:
    # Configure scene definitions
```