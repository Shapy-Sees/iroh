# DAHDI/FXS Integration Guide

This guide covers the implementation details for integrating the OpenVox A400P FXS card with the Iroh system using DAHDI drivers.

## Hardware Setup

### OpenVox A400P Configuration

The A400P card must be configured in FXS mode to provide the necessary line voltage and signaling for analog telephones. Key configuration points:

1. Line Voltage: 48V DC
2. Ring Voltage: 90V AC
3. Impedance: 600Ω
4. Loop Current: 20-30mA

### DAHDI Driver Installation

```bash
# Install DAHDI packages
sudo apt-get install dahdi-linux dahdi-tools

# Load kernel modules
sudo modprobe dahdi
sudo modprobe opvxa1200

# Verify card detection
sudo dahdi_hardware
sudo dahdi_cfg -vv
```

### System Configuration

Edit `/etc/dahdi/system.conf`:

```conf
# Define FXS channel
fxs0=1
echocanceller=mg2,1

# Audio settings
loadzone=us
defaultzone=us
```

## Software Integration

### Node.js DAHDI Interface

The system uses a native Node.js addon to interface with DAHDI. Key functions:

1. Channel Management
   - Open/close channels
   - Set line states
   - Monitor hook status

2. Audio Streaming
   - Read audio input
   - Write audio output
   - Handle audio format conversion

3. Signaling
   - Ring generation
   - DTMF detection
   - Hook state detection

### Audio Processing

Audio format requirements:

- Sample Rate: 8kHz
- Bit Depth: 16-bit
- Channels: Mono
- Format: Linear PCM

### Error Handling

Common DAHDI errors and recovery procedures:

1. Channel Busy
   - Retry after delay
   - Force channel release if stuck

2. Audio Buffer Overrun
   - Implement circular buffer
   - Monitor buffer levels
   - Drop frames if necessary

3. Hardware Timeout
   - Implement watchdog
   - Auto-reset channel
   - Log detailed diagnostics

## Integration Testing

Test scenarios that should be verified:

1. Basic Functionality
   - Off-hook detection
   - Dial tone generation
   - DTMF recognition
   - Audio playback

2. Edge Cases
   - Line noise handling
   - Power fluctuations
   - Multiple rapid off-hook/on-hook

3. Performance
   - Audio latency
   - CPU usage
   - Memory consumption

## Troubleshooting

Common issues and solutions:

1. No Dial Tone
   - Check DAHDI service status
   - Verify channel configuration
   - Test line voltage

2. Audio Quality Issues
   - Check buffer sizes
   - Verify sample rate settings
   - Test echo cancellation

3. System Crashes
   - Check kernel logs
   - Monitor hardware interrupts
   - Verify driver compatibility

## Performance Optimization

Guidelines for optimal performance:

1. Buffer Tuning
   - Adjust DAHDI buffer sizes
   - Set appropriate Node.js stream highWaterMark
   - Monitor audio glitches

2. CPU Usage
   - Use worker threads for audio processing
   - Implement efficient audio conversion
   - Profile hot spots

3. Memory Management
   - Implement proper buffer cleanup
   - Monitor memory leaks
   - Use streaming where possible

## Security Considerations

Important security measures:

1. Access Control
   - Restrict DAHDI device permissions
   - Implement command authentication
   - Log access attempts

2. Input Validation
   - Sanitize DTMF input
   - Validate audio data
   - Check buffer boundaries

3. Error Recovery
   - Implement safe fallbacks
   - Protect against buffer overflow
   - Handle hardware failures gracefully
