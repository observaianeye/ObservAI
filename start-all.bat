@echo off
REM ObservAI - Unified Startup Script (Windows)
REM Starts all services in parallel with proper port management

REM Switch the console to UTF-8 so box-drawing chars and emoji render correctly.
REM Without this, Turkish/European default code pages (CP857, CP437) turn box
REM chars into mojibake like "ÔòöÔòÉ".
chcp 65001 >nul 2>&1

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

REM Create log directory early so redirects in the Ollama block succeed.
REM Previously mkdir was after Ollama start - if logs\ did not exist yet,
REM "ollama serve > logs\ollama.log" would fail silently and Ollama would die.
if not exist "logs" mkdir logs

REM ══════════════════════════════════════════════════════════════
REM  OLLAMA - Check, Start, and Ensure Model is Ready
REM ══════════════════════════════════════════════════════════════

echo %BLUE%Checking Ollama AI service...%NC%

REM Primary / fallback models (Stage 6 — qwen3:14b → llama3.1:8b).
REM Primary is overridable via backend\.env (OLLAMA_MODEL=...); fallback is fixed.
set "OLLAMA_PRIMARY_MODEL=qwen3:14b"
set "OLLAMA_FALLBACK_MODEL=llama3.1:8b"
if exist "backend\.env" for /f "tokens=2 delims==" %%M in ('findstr /I "^OLLAMA_MODEL=" "backend\.env" 2^>nul') do set "OLLAMA_PRIMARY_MODEL=%%M"
set "OLLAMA_MODEL=!OLLAMA_PRIMARY_MODEL!"

REM GPU acceleration - if nvidia-smi is present, push all layers to the GPU.
REM NOTE: Inside an IF/ELSE block any unescaped ) closes the block prematurely,
REM so we keep the echoes paren-free here. Use dashes/colons instead.
nvidia-smi >nul 2>&1
if errorlevel 1 (
    echo       %YELLOW%WARN: nvidia-smi not found - Ollama will run on CPU, slow for 14B models.%NC%
    set "OLLAMA_NUM_GPU=0"
) else (
    set "OLLAMA_NUM_GPU=999"
    echo       %GREEN%GPU detected - enabling full layer offload, OLLAMA_NUM_GPU=999.%NC%
)

REM Check if ollama is installed
where ollama >nul 2>&1
if errorlevel 1 (
    echo %YELLOW%  Ollama not found. AI chatbot will not work. Install from: https://ollama.ai%NC%
    goto :skip_ollama
)

REM Check if Ollama is already running
curl -s --max-time 3 -o nul http://localhost:11434/ >nul 2>&1
if not errorlevel 1 (
    echo       %GREEN%Ollama is already running.%NC%
    goto :ollama_check_model
)

REM Ollama is not running — start it with GPU env vars.
echo       %YELLOW%Ollama is not running. Starting...%NC%
start "ObservAI Ollama" /min cmd /c "set OLLAMA_NUM_GPU=!OLLAMA_NUM_GPU!&& ollama serve > "%SCRIPT_DIR%logs\ollama.log" 2>&1"

REM Wait for Ollama to become ready - max 30 seconds (14B model takes longer to initialize)
set "OLLAMA_READY=0"
:ollama_wait_loop
if !OLLAMA_READY! GEQ 30 goto :ollama_wait_done
curl -s --max-time 2 -o nul http://localhost:11434/ >nul 2>&1
if not errorlevel 1 goto :ollama_started_ok
timeout /t 1 /nobreak >nul
set /a OLLAMA_READY+=1
goto :ollama_wait_loop

:ollama_started_ok
echo       %GREEN%Ollama started successfully.%NC%
goto :ollama_check_model

:ollama_wait_done
echo %RED%Ollama failed to start within 30 seconds.%NC%
echo %YELLOW%   AI chatbot and insights will not work.%NC%
goto :skip_ollama

:ollama_check_model
REM Try primary first, then fall back if the pull fails (e.g. no network / disk space).
ollama list 2>nul | findstr /I "!OLLAMA_PRIMARY_MODEL!" >nul 2>&1
if not errorlevel 1 (
    set "OLLAMA_MODEL=!OLLAMA_PRIMARY_MODEL!"
    echo       %GREEN%Model !OLLAMA_PRIMARY_MODEL! is ready.%NC%
    goto :ollama_warmup
)

echo       %YELLOW%Pulling primary model !OLLAMA_PRIMARY_MODEL! (this may take several minutes)...%NC%
ollama pull !OLLAMA_PRIMARY_MODEL!
if not errorlevel 1 (
    set "OLLAMA_MODEL=!OLLAMA_PRIMARY_MODEL!"
    echo       %GREEN%Model !OLLAMA_PRIMARY_MODEL! downloaded.%NC%
    goto :ollama_warmup
)

echo       %YELLOW%Primary pull failed — trying fallback !OLLAMA_FALLBACK_MODEL!...%NC%
ollama list 2>nul | findstr /I "!OLLAMA_FALLBACK_MODEL!" >nul 2>&1
if not errorlevel 1 (
    set "OLLAMA_MODEL=!OLLAMA_FALLBACK_MODEL!"
    echo       %GREEN%Fallback model !OLLAMA_FALLBACK_MODEL! already present.%NC%
    goto :ollama_warmup
)
ollama pull !OLLAMA_FALLBACK_MODEL!
if errorlevel 1 (
    echo %RED%Failed to download both primary and fallback models.%NC%
    goto :skip_ollama
)
set "OLLAMA_MODEL=!OLLAMA_FALLBACK_MODEL!"
echo       %GREEN%Fallback model !OLLAMA_FALLBACK_MODEL! downloaded.%NC%

:ollama_warmup
REM Warm-up request runs in background so script does not block on 14B model load (~30s).
REM First user chat may be slow if warmup not done yet, but services start immediately.
echo       %BLUE%Triggering background warm-up for !OLLAMA_MODEL! (non-blocking)...%NC%
start "ObservAI Warmup" /min cmd /c "curl -s --max-time 120 -X POST http://localhost:11434/api/generate -H "Content-Type: application/json" -d "{\"model\":\"!OLLAMA_MODEL!\",\"prompt\":\"hi\",\"stream\":false,\"options\":{\"num_predict\":4}}" > "%SCRIPT_DIR%logs\ollama-warmup.log" 2>&1"
echo       %GREEN%Warm-up running in background (see logs\ollama-warmup.log).%NC%

:ollama_done
echo %GREEN%Ollama AI ready (model: !OLLAMA_MODEL!)%NC%
echo.

:skip_ollama

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

REM Regenerate Prisma client if schema.prisma is newer than the generated client.
REM Keeps new models (e.g. Stage 6 ChatMessage) in sync without a manual step.
echo       %BLUE%Regenerating Prisma client if schema changed...%NC%
call npx prisma generate >nul 2>&1

start "ObservAI Backend API" /min cmd /c "npm run start:node > ..\logs\backend-api.log 2>&1"
timeout /t 2 /nobreak >nul
echo       %BLUE%→ Backend API running on http://localhost:3001%NC%

REM Service 3: Camera Analytics (Port 5001)
echo %GREEN%[3/4] 📹 Starting Camera Analytics AI...%NC%
cd "%SCRIPT_DIR%packages\camera-analytics"

REM ──────────────────────────────────────────────────────────
REM Yan #22 — Frontend-independent analytics persistence.
REM Python pipeline POSTs each tick to Node /api/analytics/ingest
REM when both env vars are set. Camera id is left empty here so the
REM persister stays inert until pythonBackendManager.spawn() injects it
REM (or until the user exports OBSERVAI_CAMERA_ID before launching).
REM Read OBSERVAI_INGEST_KEY from backend/.env so prod keys never leak.
REM ──────────────────────────────────────────────────────────
set "OBSERVAI_NODE_URL=http://localhost:3001"
if exist "%SCRIPT_DIR%backend\.env" for /f "tokens=2 delims==" %%K in ('findstr /I "^OBSERVAI_INGEST_KEY=" "%SCRIPT_DIR%backend\.env" 2^>nul') do set "OBSERVAI_INGEST_KEY=%%K"
set "OBSERVAI_CAMERA_ID="

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

start "ObservAI Camera AI" /min cmd /c ""%VENV_PYTHON%" -u -m camera_analytics.run_with_websocket --source 0 --model yolo11l.pt > "%SCRIPT_DIR%logs\camera-ai.log" 2>&1"
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
echo    %BLUE%Ollama AI:       %NC%http://localhost:11434
echo    %BLUE%Frontend:        %NC%http://localhost:5173
echo    %BLUE%Backend API:     %NC%http://localhost:3001
echo    %BLUE%Camera AI:       %NC%ws://0.0.0.0:5001
echo    %BLUE%Prisma Studio:   %NC%http://localhost:5555
echo.
echo %GREEN%📝 Logs:%NC%
echo    %BLUE%Ollama AI:       %NC%type logs\ollama.log
echo    %BLUE%Frontend:        %NC%type logs\frontend.log
echo    %BLUE%Backend API:     %NC%type logs\backend-api.log
echo    %BLUE%Camera AI:       %NC%type logs\camera-ai.log
echo    %BLUE%Prisma Studio:   %NC%type logs\prisma-studio.log
echo.
echo %YELLOW%💡 Run stop-all.bat to stop all services%NC%
echo %YELLOW%💡 Or close this window to keep services running in background%NC%
echo.
echo Window will close in 5 seconds. Services keep running in background.
timeout /t 5 /nobreak >nul
exit /b 0

