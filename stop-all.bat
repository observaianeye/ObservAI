@echo off
REM ObservAI - Service Shutdown Script (Windows)
REM Stops all running ObservAI services. Safe-by-design:
REM   - Window titles are EXACT match (no substring) to avoid killing user IDE/browser.
REM   - Port-based kills use PID from netstat.
REM   - /T flag does tree kill so child node/pnpm/python procs die with their cmd wrapper.
REM
REM Bug history (2026-04-29):
REM   - "(Port 5001)" inside an IF block closed the block early - removed parens.
REM   - Missing chcp 65001 caused box-drawing chars to mojibake on TR locale.

chcp 65001 >nul 2>&1
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
echo ============================================================
echo            ObservAI Service Shutdown
echo ============================================================
echo %NC%

echo %YELLOW%Searching for running services...%NC%

REM ──────────────────────────────────────────────────────────────
REM Step 1: Tree-kill cmd wrappers by EXACT window title.
REM /T = include child process tree (pnpm, tsx, node, python).
REM /FI "WINDOWTITLE eq X" = exact match, not substring.
REM ──────────────────────────────────────────────────────────────
echo %GREEN%[1/3] Killing ObservAI cmd wrappers + child trees...%NC%
taskkill /F /T /FI "WINDOWTITLE eq ObservAI Frontend" >nul 2>&1
taskkill /F /T /FI "WINDOWTITLE eq ObservAI Backend API" >nul 2>&1
taskkill /F /T /FI "WINDOWTITLE eq ObservAI Camera AI" >nul 2>&1
taskkill /F /T /FI "WINDOWTITLE eq ObservAI Prisma Studio" >nul 2>&1
taskkill /F /T /FI "WINDOWTITLE eq ObservAI Ollama" >nul 2>&1
taskkill /F /T /FI "WINDOWTITLE eq ObservAI Warmup" >nul 2>&1

REM ──────────────────────────────────────────────────────────────
REM Step 2: Port-based PID kill for any survivors.
REM NOTE: parens removed from echoes (would close IF block early).
REM ──────────────────────────────────────────────────────────────
echo %GREEN%[2/3] Killing port survivors...%NC%

call :kill_port 5001 "Camera Analytics"
call :kill_port 5555 "Prisma Studio"
call :kill_port 5173 "Frontend"
call :kill_port 3001 "Backend API"
call :kill_port 11434 "Ollama"

REM Wait for graceful shutdown
timeout /t 2 /nobreak >nul

REM ──────────────────────────────────────────────────────────────
REM Step 3: Force-kill any remaining listeners + verify.
REM ──────────────────────────────────────────────────────────────
echo %GREEN%[3/3] Verifying shutdown...%NC%

for %%P in (3001 5001 5173 5555 11434) do call :force_kill_port %%P

echo.
echo %GREEN%All ObservAI services stopped%NC%
echo.

echo %CYAN%Port Status:%NC%
for %%P in (3001 5001 5173 5555 11434) do (
    netstat -ano | findstr ":%%P " | findstr "LISTENING" >nul 2>&1
    if errorlevel 1 (
        echo    %GREEN%Port %%P: FREE%NC%
    ) else (
        echo    %RED%Port %%P: STILL OCCUPIED%NC%
    )
)

echo.
REM Auto-exit after 3s so non-interactive callers (Bash tool, CI) do not hang.
REM User can still ctrl-c during the timeout.
timeout /t 3 /nobreak >nul
exit /b 0


REM ==============================================================
REM Subroutines (placed after exit /b 0 so they don't auto-execute)
REM ==============================================================

:kill_port
REM %~1 = port number, %~2 = friendly label
set "_PORT=%~1"
set "_LABEL=%~2"
for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":!_PORT! " ^| findstr "LISTENING" 2^>nul') do (
    set "_PID=%%P"
    if defined _PID (
        echo    %GREEN%Stopping !_LABEL! port !_PORT! PID !_PID!%NC%
        taskkill /F /T /PID !_PID! >nul 2>&1
    )
)
exit /b 0

:force_kill_port
REM %~1 = port number
set "_PORT=%~1"
for /f "tokens=5" %%Q in ('netstat -ano ^| findstr ":!_PORT! " ^| findstr "LISTENING" 2^>nul') do (
    set "_PID2=%%Q"
    if defined _PID2 (
        echo    %YELLOW%Force-kill port !_PORT! PID !_PID2!%NC%
        taskkill /F /T /PID !_PID2! >nul 2>&1
    )
)
exit /b 0
