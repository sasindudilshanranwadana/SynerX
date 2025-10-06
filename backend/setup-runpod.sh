#!/bin/bash

# SynerX RunPod Setup Script
# This script automates the RunPod deployment process

echo "🚀 SynerX RunPod Setup Script"
echo "=============================="

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "❌ Please run as root: sudo ./setup-runpod.sh"
    exit 1
fi

# Update system
echo "📦 Updating system packages..."
apt update && apt upgrade -y

# Install Docker if not present
if ! command -v docker &> /dev/null; then
    echo "🐳 Installing Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    rm get-docker.sh
else
    echo "✅ Docker already installed"
fi

# Install Docker Compose if not present
if ! command -v docker-compose &> /dev/null; then
    echo "📦 Installing Docker Compose..."
    apt install docker-compose -y
else
    echo "✅ Docker Compose already installed"
fi

# Create necessary directories
echo "📁 Creating directories..."
mkdir -p temp output models .cache logs

# Set permissions
echo "🔐 Setting permissions..."
chmod 755 temp output models .cache logs

# Check for .env file
if [ ! -f ".env" ]; then
    echo "⚠️  .env file not found!"
    echo "📝 Please create .env file with your credentials:"
    echo ""
    echo "SERVER_URL=https://your-runpod-pod-url.com"
    echo "SUPABASE_URL=your_supabase_url"
    echo "SUPABASE_KEY=your_supabase_key"
    echo "CLOUDFLARE_ACCOUNT_ID=your_account_id"
    echo "R2_ACCESS_KEY_ID=your_r2_access_key"
    echo "R2_SECRET_ACCESS_KEY=your_r2_secret_key"
    echo "R2_BUCKET_NAME=synerx-videos"
    echo ""
    echo "Press Enter when you've created the .env file..."
    read
fi

# Check if .env file exists and has content
if [ -f ".env" ] && [ -s ".env" ]; then
    echo "✅ .env file found"
else
    echo "❌ .env file is empty or missing"
    echo "Please create .env file with your credentials and run this script again"
    exit 1
fi

# Build and start the application
echo "🐳 Building and starting SynerX..."
docker-compose -f docker-compose.runpod.yml up -d --build

# Wait for container to start
echo "⏳ Waiting for container to start..."
sleep 10

# Check if container is running
if docker-compose -f docker-compose.runpod.yml ps | grep -q "Up"; then
    echo "✅ SynerX is running!"
    echo ""
    echo "🌐 Your application should be accessible at:"
    echo "   http://localhost:8000"
    echo ""
    echo "📊 To monitor logs:"
    echo "   docker-compose -f docker-compose.runpod.yml logs -f"
    echo ""
    echo "🔧 To check status:"
    echo "   docker-compose -f docker-compose.runpod.yml ps"
    echo ""
    echo "🎯 To test the API:"
    echo "   curl http://localhost:8000/"
else
    echo "❌ Failed to start SynerX"
    echo "📋 Check logs:"
    echo "   docker-compose -f docker-compose.runpod.yml logs"
    exit 1
fi

echo "🎉 Setup complete!"
