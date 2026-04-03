@echo off
REM ObservAI - Unified Startup Script (Windows)
REM Starts all services in parallel with proper port management

setlocal enabledelayedexpansion

REM Get script directory
set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"

REM Enable ANSI color support (Windows 10+)
for /f %%A in ('echo prompt $E ^| cmd') do set "ESC=%%A"
set "RED=%ESC%[31m"
set "GREEN=%ESC%[32m"
set "YELLOW=%ESC%[33m"
set "BLUE=%ESC%[34m"
set "CYAN=%ESC%[36m"
set "NC=%ESC%[0m"

echo %CYAN%
echo ╔════════════════════════════════════════════════════════════╗
echo ║                    🚀 ObservAI Startup                     ║
echo ║              Starting All Services in Parallel             ║
echo ╚════════════════════════════════════════════════════════════╝
echo %NC%

REM Check dependencies
echo %BLUE%📋 Checking dependencies...%NC%

REM Check Node.js
where node >nul 2>&1
if errorlevel 1 (
    echo %RED%❌ Node.js not found. Please install Node.js 18+%NC%
    pause
    exit /b 1
)

REM Check pnpm
where pnpm >nul 2>&1
if errorlevel 1 (
    echo %RED%❌ pnpm not found. Please install pnpm: npm install -g pnpm%NC%
    pause
    exit /b 1
)

REM Check Python
where python >nul 2>&1
if errorlevel 1 (
    echo %RED%❌ Python 3 not found. Please install Python 3.11+%NC%
    pause
    exit /b 1
)

echo %GREEN%✓ All dependencies found%NC%
echo.

REM Install dependencies if needed
echo %BLUE%📦 Checking project dependencies...%NC%

REM Frontend dependencies
if not exist "frontend\node_modules" (
    echo %YELLOW%⚠️  Installing frontend dependencies...%NC%
    cd "%SCRIPT_DIR%frontend"
    call pnpm install
    cd "%SCRIPT_DIR%"
)

REM Backend dependencies
if not exist "backend\node_modules" (
    echo %YELLOW%⚠️  Installing backend dependencies...%NC%
    cd "%SCRIPT_DIR%backend"
    call npm install
    cd "%SCRIPT_DIR%"
)

REM Python venv
if not exist "packages\camera-analytics\venv" (
    echo %RED%❌ Python virtual environment not found at packages\camera-analytics\venv%NC%
    echo %YELLOW%Please create one with: python -m venv packages\camera-analytics\venv%NC%
    pause
    exit /b 1
)

echo %GREEN%✓ All dependencies installed%NC%
echo.

REM Start services
echo %CYAN%╔════════════════════════════════════════════════════════════╗%NC%
echo %CYAN%║                  Starting Services...                      ║%NC%
echo %CYAN%╚════════════════════════════════════════════════════════════╝%NC%
echo.

REM Create log directory
if not exist "logs" mkdir logs

REM Service 1: Frontend (Port 5173)
echo %GREEN%[1/4] 🎨 Starting Frontend...%NC%
cd "%SCRIPT_DIR%frontend"
start "ObservAI Frontend" /min cmd /c "pnpm dev > ..\logs\frontend.log 2>&1"
timeout /t 2 /nobreak >nul
echo       %BLUE%→ Frontend running on http://localhost:5173%NC%

REM Service 2: Backend Node.js API (Port 3001)
echo %GREEN%[2/4] 🔌 Starting Backend API...%NC%
cd "%SCRIPT_DIR%backend"

REM Install cross-env if not present (needed for ESBUILD_BINARY_PATH on Windows)
if not exist "node_modules\cross-env" (
    echo       %YELLOW%⚠️  Installing cross-env...%NC%
    call npm install cross-env --save-dev >nul 2>&1
)

start "ObservAI Backend API" /min cmd /c "npm run start:node > ..\logs\backend-api.log 2>&1"
timeout /t 2 /nobreak >nul
echo       %BLUE%→ Backend API running on http://localhost:3001%NC%

REM Service 3: Camera Analytics (Port 5001)
echo %GREEN%[3/4] 📹 Starting Camera Analytics AI...%NC%
cd "%SCRIPT_DIR%packages\camera-analytics"

REM Use venv Python directly
set "VENV_PYTHON=%SCRIPT_DIR%packages\camera-analytics\venv\Scripts\python.exe"

REM Check if lapx is installed (Windows-compatible ByteTrack dependency, no C++ build tools needed)
"%VENV_PYTHON%" -c "import lapx" >nul 2>&1
if errorlevel 1 (
    echo       %YELLOW%⚠️  Installing missing dependency: lapx...%NC%
    "%VENV_PYTHON%" -m pip install lapx >nul 2>&1
)

REM Check if yt-dlp is installed
"%VENV_PYTHON%" -c "import yt_dlp" >nul 2>&1
if errorlevel 1 (
    echo       %YELLOW%⚠️  Installing yt-dlp for YouTube support...%NC%
    "%VENV_PYTHON%" -m pip install yt-dlp >nul 2>&1
)

REM Check CUDA / GPU availability
echo       %BLUE%Checking GPU (CUDA) availability...%NC%
"%VENV_PYTHON%" -c "import torch; exit(0 if torch.cuda.is_available() else 1)" >nul 2>&1
if errorlevel 1 (
    echo       %YELLOW%WARNING: CUDA not available - running on CPU.%NC%
    echo       %YELLOW%  To enable GPU: pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu128%NC%
) else (
    echo       %GREEN%GPU CUDA available and ready.%NC%
)

start "ObservAI Camera AI" /min cmd /c ""%VENV_PYTHON%" -u -m camera_analytics.run_with_websocket --source 0 --model yolo11m.pt > "%SCRIPT_DIR%logs\camera-ai.log" 2>&1"
timeout /t 2 /nobreak >nul
echo       %BLUE%→ Camera AI running on ws://0.0.0.0:5001%NC%

REM Service 4: Prisma Studio (Port 5555)
echo %GREEN%[4/4] 🗄️  Starting Prisma Studio...%NC%
cd "%SCRIPT_DIR%backend"
start "ObservAI Prisma Studio" /min cmd /c "npx prisma studio > ..\logs\prisma-studio.log 2>&1"
timeout /t 2 /nobreak >nul
echo       %BLUE%→ Prisma Studio running on http://localhost:5555%NC%

echo.
echo %CYAN%╔════════════════════════════════════════════════════════════╗%NC%
echo %CYAN%║                 ✅ All Services Started                    ║%NC%
echo %CYAN%╚════════════════════════════════════════════════════════════╝%NC%
echo.
echo %GREEN%📍 Service URLs:%NC%
echo    %BLUE%Frontend:        %NC%http://localhost:5173
echo    %BLUE%Backend API:     %NC%http://localhost:3001
echo    %BLUE%Camera AI:       %NC%ws://0.0.0.0:5001
echo    %BLUE%Prisma Studio:   %NC%http://localhost:5555
echo.
echo %GREEN%📝 Logs:%NC%
echo    %BLUE%Frontend:        %NC%type logs\frontend.log
echo    %BLUE%Backend API:     %NC%type logs\backend-api.log
echo    %BLUE%Camera AI:       %NC%type logs\camera-ai.log
echo    %BLUE%Prisma Studio:   %NC%type logs\prisma-studio.log
echo.
echo %YELLOW%💡 Run stop-all.bat to stop all services%NC%
echo %YELLOW%💡 Or close this window to keep services running in background%NC%
echo.
echo Press any key to exit (services will continue running)...
pause >nul

