@echo off
REM ObservAI Camera Analytics Backend Starter (Windows)
REM Automatically activates venv and starts backend

cd /d "%~dp0packages\camera-analytics"

echo.
echo 🚀 Starting ObservAI Camera Analytics Backend...
echo.

REM Check if venv exists
if not exist "venv" (
    echo ❌ Error: Virtual environment not found at packages\camera-analytics\venv
    echo Please create one with: python -m venv venv
    pause
    exit /b 1
)

REM Activate virtual environment
echo ✓ Activating virtual environment...
call venv\Scripts\activate.bat

REM Check if lap is installed
python -c "import lap" 2>nul
if errorlevel 1 (
    echo ⚠️  Installing missing dependency: lap...
    pip install lap
)

REM Start backend
echo ✓ Starting backend on 0.0.0.0:5001
echo.
python -m camera_analytics.run_with_websocket --source 0

