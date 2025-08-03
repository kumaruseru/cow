#!/bin/bash

echo "🐄 COW SOCIAL NETWORK - DEVELOPMENT STARTUP SCRIPT"
echo "=================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️ $1${NC}"
}

# Check Node.js version
print_info "Checking Node.js version..."
NODE_VERSION=$(node --version)
print_status "Node.js version: $NODE_VERSION"

# Check if .env file exists
if [ -f ".env" ]; then
    print_status ".env file found"
else
    print_warning ".env file not found, copying from .env.example"
    cp .env.example .env
    print_info "Please edit .env file with your configuration"
fi

# Check MongoDB connection
print_info "Checking MongoDB connection..."
if command -v mongosh &> /dev/null; then
    print_status "MongoDB shell (mongosh) is available"
elif command -v mongo &> /dev/null; then
    print_status "MongoDB shell (mongo) is available"
else
    print_warning "MongoDB shell not found. Please ensure MongoDB is installed and running"
fi

# Create necessary directories
print_info "Creating necessary directories..."
mkdir -p uploads/profile-images
mkdir -p uploads/posts
mkdir -p logs
print_status "Directories created"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    print_info "Installing dependencies..."
    npm install
    print_status "Dependencies installed"
else
    print_status "Dependencies already installed"
fi

# Run security audit
print_info "Running security audit..."
npm audit --audit-level=moderate

# Start the server
print_info "Starting Cow Social Network server..."
echo
echo "🚀 Server will be available at: http://localhost:3000"
echo "📝 Login page: http://localhost:3000/login"
echo "📝 Register page: http://localhost:3000/register"
echo "📱 Main app: http://localhost:3000/index.html"
echo
print_status "Starting server in development mode..."

# Start with nodemon if available, otherwise use node
if command -v nodemon &> /dev/null; then
    nodemon server.js
else
    node server.js
fi
