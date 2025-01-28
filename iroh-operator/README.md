# Iroh Operator

An intelligent phone operator system that provides timer functionality, home automation control, and voice interaction through a vintage telephone interface. Named after Uncle Iroh, this system brings wisdom and harmony to your smart home.

## Core Features

- One-touch timer setting
- Home Assistant integration
- Voice interaction via Claude AI
- Text-to-speech responses
- Arduino clock display integration
- Multi-timer management
- Smart home control
- Contextual command processing

## Getting Started

### Prerequisites

- Docker and Docker Compose
- Running instance of DAHDI Phone API
- Home Assistant server (optional)
- Arduino display (optional)
- Python 3.9+

### Configuration

1. Create configuration file:
```bash
cp config/default.example.yml config/default.yml
```

2. Set required environment variables:
```bash
cp .env.example .env
```

Required environment variables:
```bash
DAHDI_API_URL=http://dahdi-api:8000
DAHDI_WS_URL=ws://dahdi-api:8001
CLAUDE_API_KEY=your_claude_api_key
ELEVENLABS_API_KEY=your_elevenlabs_key
HASS_URL=http://your-home-assistant:8123
HASS_TOKEN=your_long_lived_access_token
```

### Development Setup

1. Clone the repository:
```bash
git clone https://github.com/yourusername/iroh-operator.git
cd iroh-operator
```

2. Start the development environment:
```bash
docker-compose up -d
```

## Timer Functionality

The system enters timer mode immediately when the phone goes off-hook:

1. Pick up phone
2. Enter number of minutes directly
3. Timer starts automatically
4. Confirmation tone plays
5. Phone rings when timer completes

For all other functions, commands must start with * or #.

### Command Reference

#### Timer Commands (No Prefix Required)
- Direct number: Set timer for X minutes
- *1: List active timers
- *2: Cancel last timer
- *3: Cancel all timers

#### Home Assistant Commands
- #1: Enter Home Assistant control mode
- #11: Toggle lights
- #12: Set temperature
- #13: Activate scene
- #14: Get device status

#### Voice Commands
- #2: Enter voice interaction mode
- #21: General query
- #22: Home status query
- #23: Timer management

Full command reference available in `/docs/commands.md`

## Project Structure

```
src/
├── iroh/               # Main package
│   ├── core/          # Core operator logic
│   │   ├── operator.py
│   │   ├── phone_client.py
│   │   └── event_bus.py
│   ├── services/      # External services
│   │   ├── timer_service.py
│   │   ├── ai_service.py
│   │   ├── ha_service.py
│   │   └── arduino_service.py
│   ├── handlers/      # Command handlers
│   │   ├── command_handler.py
│   │   ├── voice_handler.py
│   │   └── timer_handler.py
│   └── utils/         # Utilities
│       ├── logger.py
│       └── config.py
```

## Development

### Running Tests

```bash
# Run all tests
docker-compose run --rm operator pytest

# Run specific test file
docker-compose run --rm operator pytest tests/test_timer_service.py

# Run with coverage
docker-compose run --rm operator pytest --cov=iroh
```

### Debugging

Start debug console:
```bash
docker-compose exec operator python debug_console.py
```

Available debug commands:
```python
# Simulate phone events
debug.simulate_off_hook()
debug.simulate_dtmf("123")
debug.simulate_voice("set a timer for 5 minutes")

# Check system state
debug.get_active_timers()
debug.get_phone_status()
debug.test_ha_connection()
```

## Integration Points

### DAHDI Phone API

The operator connects to the DAHDI Phone API for phone line control. See `/docs/dahdi-integration.md` for:
- Connection configuration
- Event handling
- Error recovery
- State management

### Home Assistant

Configure Home Assistant integration in `config/default.yml`. Features include:
- Device control
- Scene activation
- State monitoring
- Automation triggers

See `/docs/home-assistant.md` for complete setup guide.

### Arduino Display

The Arduino display shows active timers and system status. Setup involves:
- Serial connection configuration
- Display protocol
- Update frequency
- Error handling

See `/docs/arduino-setup.md` for hardware and software setup.

### Claude AI Integration

Voice interaction is powered by Anthropic's Claude. Features include:
- Natural language understanding
- Context-aware responses
- Command interpretation
- Status summaries

Configure in `config/default.yml` and see `/docs/ai-integration.md`

## Error Handling

The system implements comprehensive error recovery:

1. Hardware Errors
   - Automatic reconnection
   - Graceful degradation
   - User notification

2. Service Errors
   - Retry mechanisms
   - Fallback behaviors
   - Error logging

3. Command Errors
   - Clear feedback
   - Recovery suggestions
   - State preservation

## Contributing

Please read CONTRIBUTING.md for details on our development process and code standards.

### Development Guidelines

- Use type hints
- Add tests for new features
- Document public interfaces
- Follow PEP 8
- Add logging statements
- Update command documentation

## Architecture

See `/docs/architecture.md` for detailed information about:
- System design decisions
- Component interaction
- State management
- Event handling
- Error recovery
- Command processing
- Audio handling

## Troubleshooting

Common issues and solutions are documented in `/docs/troubleshooting.md`

## License

This project is licensed under the MIT License - see LICENSE.md

## Acknowledgments

- Anthropic's Claude AI
- Home Assistant Project
- DAHDI Project Team
- ElevenLabs Text-to-Speech
- Arduino Community

## Security Considerations

- API tokens are managed securely
- Phone line access is restricted
- Commands are validated
- Events are authenticated
- Logs are sanitized

See SECURITY.md for complete security documentation.