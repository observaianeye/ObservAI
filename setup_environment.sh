#!/bin/bash

# ObservAI Environment Setup Script
# This script sets up the complete ObservAI environment

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo "======================================"
echo "   ObservAI Environment Setup"
echo "======================================"
echo ""

# Get project root
PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_ROOT"

echo -e "${BLUE}📍 Project root: $PROJECT_ROOT${NC}"
echo ""

# Check Python
echo -e "${YELLOW}🔍 Checking Python...${NC}"
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}❌ Python3 not found!${NC}"
    echo "Please install Python 3.9+ from https://www.python.org"
    exit 1
fi

PYTHON_VERSION=$(python3 --version | awk '{print $2}')
echo -e "${GREEN}✓ Python $PYTHON_VERSION found${NC}"

# Check Python version compatibility
PYTHON_MAJOR=$(python3 -c "import sys; print(sys.version_info.major)")
PYTHON_MINOR=$(python3 -c "import sys; print(sys.version_info.minor)")

if [ "$PYTHON_MAJOR" -lt 3 ] || ([ "$PYTHON_MAJOR" -eq 3 ] && [ "$PYTHON_MINOR" -lt 9 ]); then
    echo -e "${RED}❌ Python 3.9+ required, but found $PYTHON_VERSION${NC}"
    exit 1
fi

echo ""

# Setup camera-analytics
echo -e "${YELLOW}🔧 Setting up camera-analytics package...${NC}"
cd packages/camera-analytics

# Remove old venv if exists
if [ -d ".venv" ]; then
    echo -e "${YELLOW}⚠️  Removing old virtual environment...${NC}"
    rm -rf .venv
fi

# Create new venv with Python 3.11
echo -e "${YELLOW}📦 Creating virtual environment with Python 3.11...${NC}"
if command -v python3.11 &> /dev/null; then
    python3.11 -m venv .venv
else
    echo -e "${RED}❌ Python 3.11 not found!${NC}"
    echo "Python 3.14 is too new (NumPy not supported yet)"
    echo "Please install Python 3.11: brew install python@3.11"
    exit 1
fi

# Activate venv
source .venv/bin/activate

# Upgrade pip
echo -e "${YELLOW}⬆️  Upgrading pip...${NC}"
pip install --upgrade pip --quiet

# Install package
echo -e "${YELLOW}📥 Installing camera-analytics package...${NC}"
pip install -e . --quiet

echo -e "${GREEN}✓ Camera analytics installed${NC}"

# Check optional dependencies
echo ""
echo -e "${YELLOW}🔍 Checking optional dependencies...${NC}"

# Check InsightFace
if python3 -c "from insightface.app import FaceAnalysis" 2>/dev/null; then
    echo -e "${GREEN}✓ InsightFace installed (demographics enabled)${NC}"
else
    echo -e "${YELLOW}⚠️  InsightFace not installed${NC}"
    echo "   Demographics (age/gender) will be disabled"
    echo "   To install: pip install insightface onnxruntime"
fi

# Check yt-dlp
if command -v yt-dlp &> /dev/null; then
    echo -e "${GREEN}✓ yt-dlp installed (YouTube streaming enabled)${NC}"
else
    echo -e "${YELLOW}⚠️  yt-dlp not installed${NC}"
    echo "   YouTube streaming will not work"
    echo "   To install: pip install yt-dlp"
fi

# Create data directory
echo ""
echo -e "${YELLOW}📁 Creating data directory...${NC}"
mkdir -p "$PROJECT_ROOT/packages/data/camera"
echo -e "${GREEN}✓ Data directory ready${NC}"

# Make scripts executable
echo ""
echo -e "${YELLOW}🔧 Making scripts executable...${NC}"
chmod +x "$PROJECT_ROOT/scripts/"*.sh
echo -e "${GREEN}✓ Scripts ready${NC}"

cd "$PROJECT_ROOT"

echo ""
echo "======================================"
echo -e "${GREEN}✅ Setup Complete!${NC}"
echo "======================================"
echo ""
echo -e "${BLUE}📝 Next steps:${NC}"
echo ""
echo -e "1. ${GREEN}Activate environment:${NC}"
echo "   cd packages/camera-analytics"
echo "   source .venv/bin/activate"
echo ""
echo -e "2. ${GREEN}Run camera analytics:${NC}"
echo "   ./scripts/start_camera.sh 0"
echo ""
echo -e "3. ${GREEN}Run with WebSocket:${NC}"
echo "   ./scripts/start_camera_websocket.sh 0"
echo ""
echo -e "${YELLOW}📖 For more info:${NC}"
echo "   - QUICK_REFERENCE.md - Quick commands"
echo "   - docs/HOW_TO_RUN.md - Detailed guide"
echo ""
