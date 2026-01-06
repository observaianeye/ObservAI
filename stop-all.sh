#!/bin/bash

# ObservAI - Service Shutdown Script
# Stops all running ObservAI services

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}"
echo "╔════════════════════════════════════════════════════════════╗"
echo "║              🛑 ObservAI Service Shutdown                  ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Find and kill all ObservAI related processes
echo -e "${YELLOW}🔍 Searching for running services...${NC}"

# Kill Camera Analytics Python process
CAMERA_PIDS=$(pgrep -f "camera_analytics.run_with_websocket" 2>/dev/null || true)
if [ -n "$CAMERA_PIDS" ]; then
    echo -e "${GREEN}📹 Stopping Camera Analytics (Port 5001)...${NC}"
    kill $CAMERA_PIDS 2>/dev/null || true
fi

# Kill Prisma Studio
PRISMA_PIDS=$(pgrep -f "prisma studio" 2>/dev/null || true)
if [ -n "$PRISMA_PIDS" ]; then
    echo -e "${GREEN}🗄️  Stopping Prisma Studio (Port 5555)...${NC}"
    kill $PRISMA_PIDS 2>/dev/null || true
fi

# Kill Frontend Vite
VITE_PIDS=$(pgrep -f "vite.*5173" 2>/dev/null || true)
if [ -z "$VITE_PIDS" ]; then
    VITE_PIDS=$(lsof -ti :5173 2>/dev/null || true)
fi
if [ -n "$VITE_PIDS" ]; then
    echo -e "${GREEN}🎨 Stopping Frontend (Port 5173)...${NC}"
    kill $VITE_PIDS 2>/dev/null || true
fi

# Kill Backend Node.js API
BACKEND_PIDS=$(pgrep -f "tsx.*src/index.ts" 2>/dev/null || true)
if [ -z "$BACKEND_PIDS" ]; then
    BACKEND_PIDS=$(lsof -ti :3001 2>/dev/null || true)
fi
if [ -n "$BACKEND_PIDS" ]; then
    echo -e "${GREEN}🔌 Stopping Backend API (Port 3001)...${NC}"
    kill $BACKEND_PIDS 2>/dev/null || true
fi

# Wait for graceful shutdown
sleep 2

# Force kill if any process is still running
echo -e "${YELLOW}🔄 Verifying shutdown...${NC}"

for PORT in 3001 5001 5173 5555; do
    REMAINING=$(lsof -ti :$PORT 2>/dev/null || true)
    if [ -n "$REMAINING" ]; then
        echo -e "${YELLOW}⚠️  Force killing process on port $PORT...${NC}"
        kill -9 $REMAINING 2>/dev/null || true
    fi
done

echo ""
echo -e "${GREEN}✅ All ObservAI services stopped${NC}"
echo ""

# Verify ports are free
echo -e "${CYAN}📍 Port Status:${NC}"
for PORT in 3001 5001 5173 5555; do
    if lsof -ti :$PORT &>/dev/null; then
        echo -e "   ${RED}Port $PORT: OCCUPIED${NC}"
    else
        echo -e "   ${GREEN}Port $PORT: FREE${NC}"
    fi
done

echo ""
