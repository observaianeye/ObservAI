@echo off
REM ObservAI - Service Shutdown Script (Windows)
REM Stops all running ObservAI services

setlocal enabledelayedexpansion

REM Get script directory
set "SCRIPT_DIR=%~dp0"

REM Enable ANSI color support (Windows 10+)
for /f %%A in ('echo prompt $E ^| cmd') do set "ESC=%%A"
set "RED=%ESC%[31m"
set "GREEN=%ESC%[32m"
set "YELLOW=%ESC%[33m"
set "CYAN=%ESC%[36m"
set "NC=%ESC%[0m"

echo %CYAN%
echo ╔════════════════════════════════════════════════════════════╗
echo ║              🛑 ObservAI Service Shutdown                  ║
echo ╚════════════════════════════════════════════════════════════╝
echo %NC%

REM Find and kill all ObservAI related processes
echo %YELLOW%🔍 Searching for running services...%NC%

REM Kill Camera Analytics (Port 5001)
for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":5001" 2^>nul') do (
    set "PID=%%P"
    if defined PID (
        echo %GREEN%📹 Stopping Camera Analytics (Port 5001)... PID: !PID!%NC%
        taskkill /F /PID !PID! >nul 2>&1
    )
)

REM Kill Prisma Studio (Port 5555)
for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":5555" 2^>nul') do (
    set "PID=%%P"
    if defined PID (
        echo %GREEN%🗄️  Stopping Prisma Studio (Port 5555)... PID: !PID!%NC%
        taskkill /F /PID !PID! >nul 2>&1
    )
)

REM Kill Frontend Vite (Port 5173)
for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":5173" 2^>nul') do (
    set "PID=%%P"
    if defined PID (
        echo %GREEN%🎨 Stopping Frontend (Port 5173)... PID: !PID!%NC%
        taskkill /F /PID !PID! >nul 2>&1
    )
)

REM Kill Backend Node.js API (Port 3001)
for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":3001" 2^>nul') do (
    set "PID=%%P"
    if defined PID (
        echo %GREEN%🔌 Stopping Backend API (Port 3001)... PID: !PID!%NC%
        taskkill /F /PID !PID! >nul 2>&1
    )
)

REM Kill Ollama (Port 11434)
for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":11434" 2^>nul') do (
    set "PID=%%P"
    if defined PID (
        echo %GREEN%🤖 Stopping Ollama AI (Port 11434)... PID: !PID!%NC%
        taskkill /F /PID !PID! >nul 2>&1
    )
)

REM Wait for graceful shutdown
timeout /t 2 /nobreak >nul

REM Force kill if any process is still running
echo %YELLOW%🔄 Verifying shutdown...%NC%

for %%P in (3001 5001 5173 5555 11434) do (
    for /f "tokens=5" %%Q in ('netstat -ano ^| findstr ":%%P" 2^>nul') do (
        set "PID=%%Q"
        if defined PID (
            echo %YELLOW%⚠️  Force killing process on port %%P... PID: !PID!%NC%
            taskkill /F /PID !PID! >nul 2>&1
        )
    )
)

echo.
echo %GREEN%✅ All ObservAI services stopped%NC%
echo.

REM Verify ports are free
echo %CYAN%📍 Port Status:%NC%
for %%P in (3001 5001 5173 5555 11434) do (
    netstat -ano | findstr ":%%P" >nul 2>&1
    if errorlevel 1 (
        echo    %GREEN%Port %%P: FREE%NC%
    ) else (
        echo    %RED%Port %%P: OCCUPIED%NC%
    )
)

echo.
pause

