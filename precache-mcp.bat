@echo off
REM ====================================================================
REM ObservAI - MCP paketlerini onceden indir
REM Cowork ilk basladiginda 30-60sn beklemeyi onler
REM ====================================================================

echo === MCP paketleri onceden indiriliyor ===
echo.

echo [1/2] @browsermcp/mcp indiriliyor...
call npm view @browsermcp/mcp version >nul 2>&1
call npx -y --quiet @browsermcp/mcp@latest --help >nul 2>&1
echo   [OK] @browsermcp/mcp cache'lendi

echo.
echo [2/2] @21st-dev/magic indiriliyor...
call npm view @21st-dev/magic version >nul 2>&1
call npx -y --quiet @21st-dev/magic@latest --help >nul 2>&1
echo   [OK] @21st-dev/magic cache'lendi

echo.
echo === Tamam! MCP'ler artik anlik baslatilabilir ===
pause
