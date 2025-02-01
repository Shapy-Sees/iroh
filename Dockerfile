# File: Dockerfile
# Dockerfile for the Iroh Home Management System
# This file defines the container build process for the application

# Use Python 3.9 as base image
FROM python:3.9-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first to leverage Docker cache
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the application code
COPY iroh/ ./iroh/

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONPATH=/app

# Create volume mount points for configuration and logs
VOLUME ["/app/iroh/config", "/app/logs"]

# Command to run the application
CMD ["python", "-m", "iroh"]
