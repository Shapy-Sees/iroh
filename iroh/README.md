# Iroh Home Management System

A sophisticated home automation system providing phone-based control through DTMF commands and voice recognition. Iroh aims to be both wise in its decisions and helpful in its interactions.

## Overview

Iroh turns your analog phone line into a smart home control interface by interpreting DTMF tones (phone button presses) and voice commands. It connects to a Phone API service to interact with telephone hardware, providing immediate timer creation, home automation control, and voice command processing.

## Features

### Core Functionality
- **Quick Timer Creation**: Pick up phone and press 1-9 for instant timer
- **Audio Feedback**: Voice confirmation of commands and timer completion
- **Multi-Channel Notifications**: Audio, Home Assistant, and console notifications
- **Flexible Command System**: Support for DTMF patterns and voice input
- **State Management**: Comprehensive system state tracking

### Integration Support
- Home Assistant connectivity
- Phone API service communication
- Voice recognition (future)
- External display support (planned)

### Development Features
- Comprehensive logging
- Detailed state inspection
- Configuration validation
- Health monitoring

## Prerequisites

### System Requirements
- Python 3.9+
- Network access to Phone API service
- Network connectivity for integrations
- Home Assistant instance (optional)

## Installation

1. Install Iroh:
```bash
git clone https://github.com/yourusername/iroh.git
cd iroh
pip install -e .
```

2. Create configuration files:
```bash
cp config/config.example.yml config/config.yml
cp config/commands.example.yml config/commands.yml
```

## Configuration

### Main Configuration (config.yml)
```yaml
system:
  name: "Iroh"
  debug_mode: true
  log_level: "DEBUG"

phone:
  api:
    rest_url: "http://localhost:8000"
    ws_url: "ws://localhost:8001/ws"
    timeout: 30

audio:
  enable_tts: true
  voice: "en-US-Standard-D"
  volume: 0.8

notifications:
  home_assistant:
    url: "http://homeassistant.local:8123"
    token: "your_token_here"
```

### Command Definitions (commands.yml)
```yaml
commands:
  quick_timer:
    trigger: "digit"
    pattern: "single_digit"
    description: "Set quick timer (1-9 minutes)"
    
  service:
    trigger: "*"
    patterns:
      - "*1": "lights_on"
      - "*0": "lights_off"
      - "*2XX": "set_temperature"
```

## Usage

### Quick Timer
1. Pick up phone
2. Press single digit (1-9)
3. Hang up
- System confirms: "Setting X minute timer"
- Rings phone when complete

### Service Commands
- `*1` - Turn on lights
- `*0` - Turn off lights
- `*2XX` - Set temperature to XX degrees

### Voice Commands (Future)
1. Pick up phone
2. Press # to enter voice mode
3. Speak command
4. Hang up

### Debug Commands
- `#99` - System status report
- `#98` - Active timers list
- `#97` - Last command log

## Development

### Project Structure
```
iroh/
├── core/           # Core system components
├── services/       # Integration services
├── utils/          # Utility modules
└── config/         # Configuration files
```

### Key Components
1. `IrohOperator`: Main system coordinator
2. `PhoneManager`: Phone API interface
3. `TimerManager`: Timer handling
4. `CommandParser`: Command interpretation
5. `StateManager`: System state tracking

### Adding New Commands
1. Define command in `commands.yml`
2. Create command handler in `command_parser.py`
3. Implement service logic if needed
4. Add tests

### Debug Support
- Enable debug mode in config.yml
- Use logging levels: DEBUG, INFO, WARNING, ERROR
- Monitor state changes
- Track command processing

## API Integration

### Phone API
The system requires access to a running Phone API service:

- REST API (port 8000):
  - Phone status
  - Ring control
  - Audio playback

- WebSocket API (port 8001):
  - Real-time events
  - DTMF detection
  - Phone state changes

### Home Assistant
Integration with Home Assistant for:
- Light control
- Temperature management
- Notifications
- State tracking

## Contributing
1. Fork the repository
2. Create a feature branch
3. Make changes
4. Add tests
5. Submit pull request
