# Software Setup Guide

## Environment Setup

1. Install Dependencies
```bash
# System packages
sudo apt-get update
sudo apt-get install -y \
  git \
  nodejs \
  npm \
  libasound2-dev

# Node.js dependencies
npm install
```

2. Configure Environment
```bash
# Copy example environment file
cp .env.example .env

# Edit with your API keys
nano .env
```

## API Configuration

1. Required API Keys
   - Anthropic (Claude)
   - ElevenLabs (Text-to-Speech)
   - OpenAI (Whisper)
   - Spotify/Apple Music (optional)
   - HomeKit (automatic)

2. Service Setup
   - Create ElevenLabs voice clone for Iroh
   - Configure HomeKit bridge
   - Set up music service authentication

## Development Setup

1. Local Development
```bash
# Start in development mode
npm run dev

# Run tests
npm test

# Build for production
npm run build
```

2. Docker Development
```bash
# Build container
docker-compose build

# Start services
docker-compose up -d

# View logs
docker-compose logs -f
```

## Configuration Files

1. Default Configuration (`config/default.json`)
   - Basic settings
   - Development defaults

2. Environment Configuration (`config/development.json`)
   - Local overrides
   - Testing settings

3. Production Configuration (`config/production.json`)
   - Optimized settings
   - Security configurations

## Service Configuration

1. Audio Settings
   - Sample rate
   - Buffer size
   - Voice detection thresholds

2. AI Settings
   - Model parameters
   - Response templates
   - Conversation context

3. HomeKit Settings
   - Device discovery
   - Scene configuration
   - Automation rules

## Testing

1. Unit Tests
```bash
# Run all tests
npm test

# Run specific tests
npm test -- tests/unit/dtmf-detector.test.ts
```

2. Integration Tests
```bash
# Run integration tests
npm run test:integration
```

## Deployment

1. Production Setup
```bash
# Install PM2
npm install -g pm2

# Start service
pm2 start dist/index.js --name iroh

# Monitor service
pm2 monitor
```

2. System Service
```bash
# Create systemd service
sudo nano /etc/systemd/system/iroh.service

# Enable and start
sudo systemctl enable iroh
sudo systemctl start iroh
```

## Monitoring

1. Logging
   - Check logs: `tail -f logs/iroh.log`
   - Monitor errors: `grep ERROR logs/iroh.log`

2. Performance
   - CPU usage: `top -p $(pgrep -f iroh)`
   - Memory usage: `free -h`

## Backup & Recovery

1. Configuration Backup
```bash
# Backup config files
tar -czf iroh-config-backup.tar.gz config/ .env
```

2. Database Backup (if applicable)
```bash
# Backup data
npm run backup
```

## Troubleshooting

1. Common Issues
   - Check logs for errors
   - Verify API keys
   - Test network connectivity

2. Debugging
   - Enable debug logging
   - Check system resources
   - Verify hardware connections
