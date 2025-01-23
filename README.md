
This project is written mostly by Claude AI ... so far.

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