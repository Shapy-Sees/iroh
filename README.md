
This project is written mostly by Claude AI ... so far.

Originally, this project was going to use... apparently magic, to connect to the phone. but now we're going to use DAHDI drivers.

# Iroh 🍵 - AI-Powered Vintage Phone Integration

An AI operator for your vintage telephone, bringing the latest technology of the 19th century to your smart home.


Iroh is an innovative project that brings modern smart home capabilities to vintage telephones by creating an AI-powered interface using FXS (Foreign Exchange Station) hardware. Named after the wise Uncle Iroh, this system combines the charm of traditional telephony with cutting-edge artificial intelligence to create a unique and intuitive home control experience.

## Core Features

- 🗣️ Natural Voice Interaction
  - Conversational AI powered by Anthropic's Claude
  - Natural speech synthesis via ElevenLabs
  - Context-aware responses and command interpretation

- 📞 Vintage Phone Integration
  - Support for analog phones via FXS hardware (OpenVox A400P)
  - DAHDI/Zaptel telephony interface
  - DTMF command recognition
  - High-quality audio processing

- 🏠 Home Automation
  - Deep Home Assistant integration
  - Scene and routine management
  - Device control and status monitoring
  - Customizable automation triggers

- 🎵 Media Control
  - Music streaming service integration
  - Multi-room audio control
  - Playlist management
  - Volume and playback control

- 🌤️ Information Services
  - Weather updates and forecasts
  - Calendar integration
  - Reminders and timers
  - General knowledge queries

## System Architecture

The system is built around three main components:

### 1. Hardware Layer
- **FXS Interface**: Uses OpenVox A400P cards with DAHDI drivers to interface with analog phones
- **Audio Processing**: Handles voice input/output, DTMF detection, and audio streaming
- **Telephony Control**: Manages hook states, ring detection, and line voltage

### 2. Core Services
- **AI Engine**: 
  - Claude API for natural language understanding
  - ElevenLabs for voice synthesis
  - Context management and conversation tracking
  
- **Service Manager**:
  - Coordinates between different system components
  - Handles command routing and execution
  - Manages system state and recovery

- **Integration Services**:
  - Home Assistant client for device control
  - Media service adapters
  - External API integrations

### 3. Control Layer
- **Intent Handler**: Processes and routes user commands
- **State Manager**: Maintains system and device states
- **Event Bus**: Coordinates asynchronous operations
- **Feedback System**: Provides user feedback through voice and tones

## Data Flow

1. **Input Processing**:
   - Phone goes off-hook
   - Voice input is captured and digitized
   - DTMF tones are detected and decoded

2. **Command Processing**:
   - Speech is converted to text
   - Intent is detected and classified
   - Commands are routed to appropriate services

3. **Execution**:
   - Commands are translated to API calls
   - Services execute requested actions
   - State changes are tracked and monitored

4. **Feedback**:
   - Success/failure is determined
   - Appropriate response is generated
   - Voice response is synthesized and played
   - Tone feedback is provided when appropriate

## Technical Stack

- **Core Platform**: Node.js with TypeScript
- **AI Services**: 
  - Anthropic Claude API
  - ElevenLabs Text-to-Speech
- **Home Automation**: Home Assistant REST API
- **Telephony**: DAHDI/Zaptel Linux drivers
- **Hardware Support**: OpenVox A400P FXS cards
- **Development Tools**:
  - Docker for containerization
  - Jest for testing
  - Winston for logging

## Project Structure

The project follows a carefully organized directory structure that separates concerns while maintaining clear relationships between components. Here is the complete directory layout with explanations for each section:

```
iroh/
├── src/                      # Source code root
│   ├── app.ts               # Main application entry point
│   │
│   ├── audio/               # Audio processing components
│   │   ├── pipeline.ts      # Audio processing pipeline
│   │   ├── dtmf-detector.ts # DTMF tone detection
│   │   └── voice-detector.ts # Voice activity detection
│   │
│   ├── config/              # Configuration management
│   │   ├── index.ts         # Configuration loading and validation
│   │   ├── dahdi.ts         # DAHDI-specific configuration
│   │   └── fxs.config.ts    # FXS hardware configuration
│   │
│   ├── controllers/         # System controllers
│   │   ├── phone-controller.ts     # Main phone interface controller
│   │   └── phone-feedback-handler.ts # User feedback management
│   │
│   ├── core/                # Core system components
│   │   ├── index.ts         # Core initialization
│   │   ├── constants.ts     # System-wide constants
│   │   ├── event-bus.ts     # Event management system
│   │   └── state-manager.ts # Global state management
│   │
│   ├── debug/               # Debugging utilities
│   │   └── debug-console.ts # Interactive debug console
│   │
│   ├── hardware/            # Hardware interfaces
│   │   ├── dahdi-interface.ts      # DAHDI driver interface
│   │   └── dahdi-audio-converter.ts # Audio format conversion
│   │
│   ├── services/            # Service implementations
│   │   ├── ai/             # AI service components
│   │   │   ├── ai-service.ts          # Claude integration
│   │   │   └── conversation-manager.ts # Context management
│   │   │
│   │   ├── home/           # Home automation components
│   │   │   ├── ha_service.ts # Home Assistant service
│   │   │   ├── ha_client.ts  # Home Assistant API client
│   │   │   └── types.ts      # Home Assistant types
│   │   │
│   │   ├── music/          # Music service components
│   │   │   └── music-service.ts # Music playback service
│   │   │
│   │   ├── timer/          # Timer service components
│   │   │   └── timer-service.ts # Timer management
│   │   │
│   │   ├── hardware/       # Hardware service components
│   │   │   └── hardware-service.ts # Hardware management
│   │   │
│   │   ├── intent/         # Intent processing
│   │   │   └── intent-handler.ts # Command intent detection
│   │   │
│   │   └── service-manager.ts # Service coordination
│   │
│   └── types/              # TypeScript type definitions
        ├── index.ts        # Core shared types (Config, Status, Events)
        ├── dahdi.ts        # DAHDI hardware types  
        ├── fxs.ts          # FXS hardware types
        └── service/
            ├── ai.ts       # AI service types
            ├── home.ts     # Home Assistant types
            ├── music.ts    # Music service types
            └── index.ts    # Re-exports service types
│   └── utils/              # Utility functions
│       ├── logger.ts       # Logging system
│       ├── cache.ts        # Caching implementation
│       ├── circular-buffer.ts # Audio buffer management
│       ├── error-handler.ts   # Error handling system
│       ├── error-messages.ts  # User-facing error messages
│       ├── stream-utils.ts    # Stream processing utilities
│       └── success-feedback.ts # Success message handling
│
├── config/                  # Configuration files
│   ├── default.json        # Default configuration
│   ├── development.json    # Development environment config
│   └── production.json     # Production environment config
│
├── scripts/                 # Utility scripts
│   ├── debug.sh            # Debug script
│   ├── dev.sh             # Development environment script
│   └── shell.sh           # Container shell access
│
├── docs/                    # Documentation
│   ├── api-docs.md         # API documentation
│   ├── commands-doc.md     # Command reference
│   ├── dahdi-implementation.md # DAHDI integration guide
│   ├── hardware-setup.md   # Hardware setup guide
│   └── software-setup.md   # Software setup guide
│
├── tests/                  # Test suites
│   ├── unit/              # Unit tests
│   ├── integration/       # Integration tests
│   └── setup.ts           # Test configuration
│
├── docker-compose.yml      # Docker composition
├── Dockerfile             # Main Docker configuration
├── Dockerfile.dev         # Development Docker configuration
├── jest.config.js         # Jest test configuration
├── package.json           # NPM package configuration
├── tsconfig.json          # TypeScript configuration
└── README.md              # Project documentation
```


## Getting Started

### Prerequisites
- Linux system with DAHDI drivers installed
- OpenVox A400P FXS card
- Node.js 16+
- Docker and Docker Compose
- Home Assistant instance
- Required API keys:
  - Anthropic Claude
  - ElevenLabs
  - Home Assistant long-lived access token

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/iroh.git

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your API keys and configuration

# Start the development environment
./scripts/dev.sh
```

## Development

The project uses a containerized development environment:

```bash
# Start development container
./scripts/dev.sh

# Access development shell
./scripts/shell.sh

# View logs
docker-compose logs -f
```

## Project Philosophy

Iroh embodies the wisdom and patience of its namesake, providing a bridge between the classic charm of vintage telephony and modern smart home technology. The system aims to create a unique and intuitive interface that preserves the simplicity and tactile satisfaction of using a traditional telephone while providing access to advanced features.

Like Uncle Iroh's approach to teaching, the system provides guidance and functionality with patience and wisdom, making complex technology accessible through a familiar interface. It maintains harmony between old and new, proving that sometimes the best path forward is one that respects and incorporates the past.

## Contributing

We welcome contributions! Please read our contributing guidelines and code of conduct before submitting pull requests.

> "Life happens wherever you are, whether you make it or not." - Uncle Iroh

## License

This project is licensed under the MIT License - see the LICENSE file for details.