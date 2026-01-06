#!/bin/bash

# ObservAI - Unified Startup Script
# Starts all services in parallel with proper port management

set -e  # Exit on error

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Cleanup function
cleanup() {
    echo ""
    echo -e "${YELLOW}🛑 Shutting down all services...${NC}"

    # Kill all background jobs
    jobs -p | xargs -r kill 2>/dev/null || true

    # Wait a moment for graceful shutdown
    sleep 2

    # Force kill if still running
    jobs -p | xargs -r kill -9 2>/dev/null || true

    echo -e "${GREEN}✓ All services stopped${NC}"
    exit 0
}

# Trap Ctrl+C and call cleanup
trap cleanup SIGINT SIGTERM

echo -e "${CYAN}"
echo "╔════════════════════════════════════════════════════════════╗"
echo "║                    🚀 ObservAI Startup                     ║"
echo "║              Starting All Services in Parallel             ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Check dependencies
echo -e "${BLUE}📋 Checking dependencies...${NC}"

# Check Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js not found. Please install Node.js 18+${NC}"
    exit 1
fi

# Check pnpm
if ! command -v pnpm &> /dev/null; then
    echo -e "${RED}❌ pnpm not found. Please install pnpm: npm install -g pnpm${NC}"
    exit 1
fi

# Check Python
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}❌ Python 3 not found. Please install Python 3.11+${NC}"
    exit 1
fi

echo -e "${GREEN}✓ All dependencies found${NC}"
echo ""

# Install dependencies if needed
echo -e "${BLUE}📦 Checking project dependencies...${NC}"

# Frontend dependencies
if [ ! -d "frontend/node_modules" ]; then
    echo -e "${YELLOW}⚠️  Installing frontend dependencies...${NC}"
    cd "$SCRIPT_DIR/frontend"
    pnpm install
    cd "$SCRIPT_DIR"
fi

# Backend dependencies
if [ ! -d "backend/node_modules" ]; then
    echo -e "${YELLOW}⚠️  Installing backend dependencies...${NC}"
    cd "$SCRIPT_DIR/backend"
    npm install
    cd "$SCRIPT_DIR"
fi

# Python venv
if [ ! -d "packages/camera-analytics/venv" ]; then
    echo -e "${RED}❌ Python virtual environment not found at packages/camera-analytics/venv${NC}"
    echo -e "${YELLOW}Please create one with: python3 -m venv packages/camera-analytics/venv${NC}"
    exit 1
fi

echo -e "${GREEN}✓ All dependencies installed${NC}"
echo ""

# Start services
echo -e "${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║                  Starting Services...                      ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Create log directory
mkdir -p "$SCRIPT_DIR/logs"

# Service 1: Frontend (Port 5173)
echo -e "${GREEN}[1/4] 🎨 Starting Frontend...${NC}"
cd "$SCRIPT_DIR/frontend"
pnpm dev > "$SCRIPT_DIR/logs/frontend.log" 2>&1 &
FRONTEND_PID=$!
echo -e "      ${BLUE}→ Frontend running on http://localhost:5173 (PID: $FRONTEND_PID)${NC}"

# Service 2: Backend Node.js API (Port 3001)
echo -e "${GREEN}[2/4] 🔌 Starting Backend API...${NC}"
cd "$SCRIPT_DIR/backend"
npm run start:node > "$SCRIPT_DIR/logs/backend-api.log" 2>&1 &
BACKEND_API_PID=$!
echo -e "      ${BLUE}→ Backend API running on http://localhost:3001 (PID: $BACKEND_API_PID)${NC}"

# Service 3: Camera Analytics (Port 5001)
echo -e "${GREEN}[3/4] 📹 Starting Camera Analytics AI...${NC}"
cd "$SCRIPT_DIR/packages/camera-analytics"
source venv/bin/activate

# Check if lap is installed
if ! python3 -c "import lap" 2>/dev/null; then
    echo -e "${YELLOW}      ⚠️  Installing missing dependency: lap...${NC}"
    pip install lap > /dev/null 2>&1
fi

# Check if yt-dlp is installed (for YouTube video support)
if ! python3 -c "import yt_dlp" 2>/dev/null; then
    echo -e "${YELLOW}      ⚠️  Installing yt-dlp for YouTube support...${NC}"
    pip install yt-dlp > /dev/null 2>&1
fi

python3 -m camera_analytics.run_with_websocket --source 0 > "$SCRIPT_DIR/logs/camera-ai.log" 2>&1 &
CAMERA_AI_PID=$!
echo -e "      ${BLUE}→ Camera AI running on ws://0.0.0.0:5001 (PID: $CAMERA_AI_PID)${NC}"

# Service 4: Prisma Studio (Port 5555)
echo -e "${GREEN}[4/4] 🗄️  Starting Prisma Studio...${NC}"
cd "$SCRIPT_DIR/backend"
npx prisma studio > "$SCRIPT_DIR/logs/prisma-studio.log" 2>&1 &
PRISMA_PID=$!
echo -e "      ${BLUE}→ Prisma Studio running on http://localhost:5555 (PID: $PRISMA_PID)${NC}"

echo ""
echo -e "${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║                 ✅ All Services Started                    ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}📍 Service URLs:${NC}"
echo -e "   ${BLUE}Frontend:        ${NC}http://localhost:5173"
echo -e "   ${BLUE}Backend API:     ${NC}http://localhost:3001"
echo -e "   ${BLUE}Camera AI:       ${NC}ws://0.0.0.0:5001"
echo -e "   ${BLUE}Prisma Studio:   ${NC}http://localhost:5555"
echo ""
echo -e "${GREEN}📝 Logs:${NC}"
echo -e "   ${BLUE}Frontend:        ${NC}tail -f $SCRIPT_DIR/logs/frontend.log"
echo -e "   ${BLUE}Backend API:     ${NC}tail -f $SCRIPT_DIR/logs/backend-api.log"
echo -e "   ${BLUE}Camera AI:       ${NC}tail -f $SCRIPT_DIR/logs/camera-ai.log"
echo -e "   ${BLUE}Prisma Studio:   ${NC}tail -f $SCRIPT_DIR/logs/prisma-studio.log"
echo ""
echo -e "${YELLOW}💡 Press Ctrl+C to stop all services${NC}"
echo ""

# Wait for all background jobs
wait
