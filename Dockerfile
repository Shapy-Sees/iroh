# src/Dockerfile
#
# Main Dockerfile for Iroh project
# Assumes DAHDI drivers are installed on the host system

FROM node:16-slim

# Install only the essential build tools
RUN apt-get update && apt-get install -y \
    build-essential \
    python3 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy application code
COPY . .

# Build TypeScript code
RUN npm run build

# Set development environment by default
ENV NODE_ENV=development

# Start application
CMD ["npm", "start"]