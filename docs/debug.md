# Iroh Debug Guide

## Quick Start

Start the application in different debug modes:

# run application in dev mode
NODE_ENV=development npm start

# Start debug console?
debug console

# Start application with debugger?
debug inspect

# Run tests with debugger?
debug test

## Example debug session:

iroh-debug> help
Available Commands:
  help                - Show available commands
  off-hook            - Simulate phone going off-hook
  on-hook            - Simulate phone going on-hook
  dtmf <digit>       - Send DTMF tone (0-9, *, #)
  voice <text>       - Simulate voice command
  timer <minutes>    - Set a timer
  status             - Show system status
  exit               - Exit debug console

iroh-debug> off-hook
Debug: Simulating off-hook
Phone off-hook detected

iroh-debug> voice play some music
Debug: Simulating voice command
Processing voice command...

iroh-debug> dtmf 1
Debug: Sending DTMF
DTMF tone 1 detected