#!/bin/bash

# ObservAI Frontend Starter

cd "$(dirname "$0")/frontend"

echo "🚀 Starting ObservAI Frontend..."
echo ""

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "⚠️  node_modules not found, installing dependencies..."
    pnpm install
fi

# Start frontend
echo "✓ Starting frontend development server..."
echo ""
pnpm dev
