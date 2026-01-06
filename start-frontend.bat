@echo off
REM ObservAI Frontend Starter (Windows)

cd /d "%~dp0frontend"

echo.
echo 🚀 Starting ObservAI Frontend...
echo.

REM Check if node_modules exists
if not exist "node_modules" (
    echo ⚠️  node_modules not found, installing dependencies...
    call pnpm install
)

REM Start frontend
echo ✓ Starting frontend development server...
echo.
call pnpm dev

