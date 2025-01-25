#!/bin/bash
# scripts/debug.sh
#
# Internal container debug script that provides debugging utilities
# for the Iroh project when running inside Docker. This script is
# copied to /usr/local/bin/debug in the container.

# Set default configuration
LOG_LEVEL=${LOG_LEVEL:-"debug"}
NODE_ENV=${NODE_ENV:-"development"}

# Enable Node.js debugging
export NODE_OPTIONS="--inspect=0.0.0.0:9229"

case "$1" in
    "console")
        # Start debug console
        node --inspect=0.0.0.0:9229 -r ts-node/register src/debug/debug-console.ts
        ;;
    "inspect")
        # Start application in inspect mode
        node --inspect=0.0.0.0:9229 -r ts-node/register src/app.ts
        ;;
    "test")
        # Run tests with debugging enabled
        node --inspect=0.0.0.0:9229 node_modules/.bin/jest --runInBand
        ;;
    *)
        echo "Usage: debug [console|inspect|test]"
        echo ""
        echo "Commands:"
        echo "  console  - Start debug console"
        echo "  inspect  - Start application in debug mode"
        echo "  test     - Run tests with debugging enabled"
        exit 1
        ;;
esac