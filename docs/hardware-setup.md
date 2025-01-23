# Iroh Hardware Setup Guide

This guide explains how to set up and configure the hardware components needed for the Iroh vintage telephone integration system. We will cover everything from selecting compatible hardware to testing the final configuration.

## Required Hardware Components

To build an Iroh system, you will need several key components that work together to bridge the gap between vintage telephony and modern smart home technology.

### Core Components

1. OpenVox A400P FXS Card
   The A400P is a PCI-based telephony interface card that provides Foreign Exchange Station (FXS) ports. FXS ports supply the necessary voltage and signals that make analog telephones work. When selecting your A400P, consider these specifications:
   - 4 FXS ports per card
   - PCI 2.2 compliant
   - 3.3V or 5V signaling support
   - Hardware echo cancellation
   - Maximum power consumption: 15W
   
2. Vintage Telephone
   Most analog telephones will work with the system. The telephone should have:
   - Working rotary dial or DTMF keypad
   - Functional hook switch
   - Standard RJ11 connector or adaptable wiring
   - Minimum impedance of 600Ω
   
3. Linux-Compatible Computer
   The host system needs these minimum specifications:
   - CPU: Dual-core 2GHz or better
   - RAM: 4GB minimum (8GB recommended)
   - Storage: 32GB minimum for OS and software
   - PCI slot for A400P card
   - Ubuntu 20.04 LTS or newer recommended

### Additional Components

1. RJ11 Telephone Cable
   - High-quality shielded cable recommended
   - Maximum length: 100 meters
   - CAT3 or better specification

2. Power Supply
   Ensure your computer's power supply can handle the additional load from the A400P card:
   - Minimum 400W PSU recommended
   - Clean 12V rail for telephony card
   - UPS backup recommended

## Hardware Installation

Let's go through the physical installation process step by step.

### Preparing Your System

1. Power Down and Safety
   Always begin with a fully powered-down system and take proper ESD precautions:
   ```bash
   sudo shutdown -h now
   # Wait for full shutdown
   # Unplug system from wall
   # Use anti-static wrist strap
   ```

2. Case Preparation
   You'll need good access to:
   - PCI slot
   - Power connections
   - Front panel audio headers (if using internal audio)

### Installing the A400P Card

1. Physical Installation
   - Remove the case cover
   - Identify an available PCI slot
   - Remove the slot cover
   - Insert the A400P card firmly and evenly
   - Secure the bracket
   - Double-check all connections

2. Jumper Configuration
   The A400P requires specific jumper settings for FXS operation:
   ```
   JP1: Pins 1-2 (FXS mode)
   JP2: Open (Normal operation)
   JP3: Pins 2-3 (PCI clock source)
   ```

### Telephone Connection

1. Wiring Preparation
   Standard RJ11 pinout for FXS connection:
   ```
   Pin 1: Not used
   Pin 2: Not used
   Pin 3: Ring (Green)
   Pin 4: Tip (Red)
   Pin 5: Not used
   Pin 6: Not used
   ```

2. Testing Connections
   Before full assembly:
   - Check continuity of telephone line
   - Verify polarity is correct
   - Ensure proper grounding

## Software Configuration

After physical installation, the system needs proper software configuration.

### DAHDI Driver Installation

1. Install Required Packages
   ```bash
   sudo apt update
   sudo apt install -y build-essential linux-headers-$(uname -r) \
                      dahdi dahdi-linux dahdi-tools
   ```

2. Configure DAHDI
   Create `/etc/dahdi/system.conf`:
   ```conf
   # Basic FXS configuration
   span=1,1,0,sw,fxs_ls
   fxs0=1
   loadzone = us
   defaultzone = us
   echocanceller = mg2,1
   ```

3. Generate Configuration
   ```bash
   sudo dahdi_genconf
   sudo dahdi_cfg -vv
   ```

### Testing the Installation

1. Verify Card Detection
   ```bash
   sudo dahdi_hardware
   # Should show OpenVox A400P
   
   sudo dahdi_scan
   # Should list configured channels
   ```

2. Basic Line Test
   ```bash
   sudo dahdi_test 1
   # Tests channel 1 for proper operation
   ```

3. Audio Testing
   Simple audio loopback test:
   ```bash
   sudo dahdi_monitor 1 -v
   # Monitor channel 1 audio
   ```

## Troubleshooting

Let's look at common issues and their solutions.

### No Dial Tone

1. Check Physical Connections
   - Verify card seating in PCI slot
   - Check RJ11 cable connections
   - Confirm telephone hook switch operation

2. Verify Power
   ```bash
   sudo dahdi_hardware -v
   # Check for voltage readings
   ```

3. Test Line Voltage
   ```bash
   sudo dahdi_test -v 1
   # Should show ~48V DC
   ```

### Audio Quality Issues

1. Check Echo Cancellation
   ```bash
   sudo dahdi_cfg -v
   # Verify echo canceller loading
   ```

2. Monitor Line Quality
   ```bash
   sudo dahdi_monitor 1 -m
   # Shows audio levels and quality metrics
   ```

### System Integration Testing

Once basic functionality is confirmed, test the complete system:

1. Hook State Detection
   ```bash
   # Using our test utility
   sudo iroh-test hook 1
   # Should show hook state changes
   ```

2. DTMF Recognition
   ```bash
   # Test DTMF detection
   sudo iroh-test dtmf 1
   # Press keys to verify detection
   ```

3. Voice Quality
   ```bash
   # Record and playback test
   sudo iroh-test audio 1
   # Should provide clear audio
   ```

## Maintenance and Monitoring

Regular maintenance helps ensure reliable operation:

1. System Logs
   Check logs regularly for issues:
   ```bash
   sudo tail -f /var/log/dahdi
   sudo tail -f /var/log/iroh/hardware.log
   ```

2. Performance Monitoring
   Monitor system resource usage:
   ```bash
   top -p $(pgrep -d',' dahdi)
   ```

3. Backup Configuration
   Keep backups of working configurations:
   ```bash
   sudo cp /etc/dahdi/system.conf /etc/dahdi/system.conf.backup
   ```

Remember to maintain proper documentation of any changes or customizations made to your installation. This will help with troubleshooting and future upgrades.

## Safety Considerations

Please keep these important safety points in mind:

1. High Voltage Present
   - FXS ports carry ~48V DC
   - Ring voltage can reach ~90V AC
   - Always disconnect power before servicing

2. Proper Grounding
   - Ensure chassis is properly grounded
   - Use grounded power outlets
   - Consider dedicated circuit for clean power

3. Lightning Protection
   - Install telephone line surge protectors
   - Use UPS for power protection
   - Consider optical isolation for long runs

By following this guide carefully and maintaining proper safety procedures, you'll have a reliable hardware foundation for your Iroh system.