#!/bin/bash

# GymTie Local Bridge Deployment Script for Raspberry Pi
# This script automates the deployment process

set -e

echo "======================================"
echo "GymTie Local Bridge Deployment"
echo "======================================"
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "Docker is not installed. Installing Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    echo "Docker installed. Please log out and log back in, then run this script again."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "Docker Compose is not installed. Installing Docker Compose..."
    sudo apt-get update
    sudo apt-get install -y docker-compose
fi

echo "✓ Docker and Docker Compose are installed"
echo ""

# Check if .env file exists
if [ ! -f .env ]; then
    echo "⚠ .env file not found. Creating from .env.example..."
    cp .env.example .env
    echo ""
    echo "Please edit the .env file with your configuration:"
    echo "  - STRAPI_URL: Your remote Strapi server URL"
    echo "  - STRAPI_API_TOKEN or STRAPI_EMAIL/PASSWORD: Authentication credentials"
    echo "  - GYM_ID: Your gym ID from Strapi"
    echo "  - HIKVISION_IP: Local IP address of your biometric device"
    echo "  - HIKVISION_USERNAME/PASSWORD: Device credentials"
    echo ""
    echo "After editing .env, run this script again."
    exit 0
fi

echo "✓ .env file found"
echo ""

# Create necessary directories
echo "Creating directories..."
mkdir -p logs data/queue
echo "✓ Directories created"
echo ""

# Stop existing container if running
if [ "$(docker ps -q -f name=gymtie-bridge)" ]; then
    echo "Stopping existing container..."
    docker-compose down
    echo "✓ Container stopped"
    echo ""
fi

# Build and start the container
echo "Building Docker image..."
docker-compose build

echo ""
echo "Starting container..."
docker-compose up -d

echo ""
echo "======================================"
echo "Deployment Complete!"
echo "======================================"
echo ""
echo "The GymTie Local Bridge is now running."
echo ""
echo "Useful commands:"
echo "  - View logs: docker logs -f gymtie-bridge"
echo "  - Stop: docker-compose down"
echo "  - Restart: docker-compose restart"
echo "  - Check health: curl http://localhost:3000/health"
echo ""
echo "Next steps:"
echo "  1. Test device connection: curl http://localhost:3000/health/device"
echo "  2. Test Strapi connection: curl http://localhost:3000/health/strapi"
echo "  3. Sync members: curl -X POST http://localhost:3000/sync/members"
echo ""
