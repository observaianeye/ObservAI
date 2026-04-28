@echo off
REM ============================================================
REM   ObservAI Skills Bundle - Windows Installer
REM   ----------------------------------------------------------
REM   Bu script:
REM    - Vercel skills CLI ile global skiller kurar
REM      (~/.claude/skills/ -> C:\Users\%USERNAME%\.claude\skills\)
REM    - RuFlo orchestration platformunu kurar
REM    - Tum kurulan skilleri Claude Code + Cowork icin -g flag ile
REM      kullanici seviyesinde aktive eder
REM   ----------------------------------------------------------
REM   Kullanim:
REM     install.bat            - Hepsini kur
REM     install.bat skills     - Sadece skiller
REM     install.bat ruflo      - Sadece RuFlo
REM     install.bat verify     - Kurulu mu kontrol et
REM ============================================================

setlocal enabledelayedexpansion

set "MODE=%~1"
if "%MODE%"=="" set "MODE=all"

echo.
echo ============================================================
echo   ObservAI Skills Bundle Installer
echo ============================================================
echo.

REM --- Node.js / npm kontrolu ---
where node >nul 2>nul
if errorlevel 1 (
    echo [HATA] Node.js bulunamadi.
    echo Kurmak icin: https://nodejs.org/
    pause
    exit /b 1
)

where npx >nul 2>nul
if errorlevel 1 (
    echo [HATA] npx bulunamadi.
    pause
    exit /b 1
)

for /f "tokens=*" %%v in ('node --version') do echo [OK] Node.js %%v
for /f "tokens=*" %%v in ('npm --version') do echo [OK] npm %%v
echo.

REM --- Skill dizinini hazirla ---
set "CLAUDE_DIR=%USERPROFILE%\.claude"
set "SKILLS_DIR=%CLAUDE_DIR%\skills"
if not exist "%CLAUDE_DIR%" mkdir "%CLAUDE_DIR%"
if not exist "%SKILLS_DIR%" mkdir "%SKILLS_DIR%"
echo [OK] Skill dizini: %SKILLS_DIR%
echo.

if /i "%MODE%"=="verify" goto :VERIFY
if /i "%MODE%"=="ruflo"  goto :RUFLO
if /i "%MODE%"=="skills" goto :SKILLS

REM --- Default: hepsini kur ---
:SKILLS
echo ============================================================
echo   1) Anthropic resmi skiller (anthropics/skills)
echo ============================================================
echo.

REM Anthropic resmi skiller — production-grade
call :INSTALL_SKILL anthropics/skills webapp-testing
call :INSTALL_SKILL anthropics/skills frontend-design
call :INSTALL_SKILL anthropics/skills claude-api
call :INSTALL_SKILL anthropics/skills mcp-builder
call :INSTALL_SKILL anthropics/skills skill-creator
call :INSTALL_SKILL anthropics/skills web-artifacts-builder

echo.
echo ============================================================
echo   2) obra/superpowers (test + plan + multi-agent)
echo ============================================================
echo.

REM Multi-agent + planning skiller — RuFlo ile uyumlu calisir
call :INSTALL_SKILL obra/superpowers test-driven-development
call :INSTALL_SKILL obra/superpowers systematic-debugging
call :INSTALL_SKILL obra/superpowers subagent-driven-development
call :INSTALL_SKILL obra/superpowers dispatching-parallel-agents
call :INSTALL_SKILL obra/superpowers writing-plans
call :INSTALL_SKILL obra/superpowers executing-plans
call :INSTALL_SKILL obra/superpowers verification-before-completion
call :INSTALL_SKILL obra/superpowers using-git-worktrees
call :INSTALL_SKILL obra/superpowers requesting-code-review
call :INSTALL_SKILL obra/superpowers brainstorming

echo.
echo ============================================================
echo   3) ComposioHQ awesome-claude-skills
echo ============================================================
echo.

call :INSTALL_SKILL ComposioHQ/awesome-claude-skills changelog-generator
call :INSTALL_SKILL ComposioHQ/awesome-claude-skills file-organizer
call :INSTALL_SKILL ComposioHQ/awesome-claude-skills meeting-insights-analyzer
call :INSTALL_SKILL ComposioHQ/awesome-claude-skills developer-growth-analysis
call :INSTALL_SKILL ComposioHQ/awesome-claude-skills artifacts-builder
call :INSTALL_SKILL ComposioHQ/awesome-claude-skills content-research-writer

if /i "%MODE%"=="skills" goto :END

:RUFLO
echo.
echo ============================================================
echo   4) RuFlo - Multi-Agent Orchestration Platform
echo ============================================================
echo.

REM RuFlo'yu global npm package olarak kur
echo [INSTALL] npm install -g ruflo@latest
call npm install -g ruflo@latest
if errorlevel 1 (
    echo [UYARI] Global RuFlo kurulumu basarisiz oldu.
    echo Alternatif: npx ile her zaman calistirilir.
)

REM RuFlo init wizard (kullanici tercihine birakildi)
echo.
echo ============================================================
echo   RuFlo init wizard'i icin manuel komut:
echo     cd C:\Users\Gaming\Desktop\Project\ObservAI
echo     npx ruflo@latest init --wizard
echo ============================================================
echo.

if /i "%MODE%"=="ruflo" goto :END

:VERIFY
echo.
echo ============================================================
echo   Dogrulama: Kurulu skiller
echo ============================================================
echo.
call npx -y skills list -g 2>nul
echo.
echo Dizin: %SKILLS_DIR%
echo.
where ruflo >nul 2>nul
if errorlevel 1 (
    echo [INFO] ruflo CLI global olarak kurulu degil. npx ruflo@latest ile calistirilabilir.
) else (
    for /f "tokens=*" %%v in ('ruflo --version 2^>nul') do echo [OK] ruflo %%v
)

if /i "%MODE%"=="verify" goto :END

:END
echo.
echo ============================================================
echo   Kurulum tamamlandi.
echo ============================================================
echo.
echo Sonraki adimlar:
echo   1) Claude Code'u yeniden baslat (terminal acik ise kapat/ac)
echo   2) Cowork'u yeniden baslat
echo   3) Su komutla skilleri test et:
echo      npx skills list -g
echo   4) USAGE_GUIDE.md dosyasini oku - ObservAI ornekleri
echo.
pause
goto :EOF


REM ====================================================================
REM   Yardimci: Tek skill kur
REM   Kullanim: call :INSTALL_SKILL <repo> <skill-name>
REM ====================================================================
:INSTALL_SKILL
set "REPO=%~1"
set "SKILL=%~2"
echo [INSTALL] %REPO% --skill %SKILL% (global, claude-code)
call npx -y skills add %REPO% --skill %SKILL% -g -a claude-code -y --copy >nul 2>&1
if errorlevel 1 (
    echo   [SKIP] %SKILL% kurulamadi - zaten var olabilir veya repo'da yok.
) else (
    echo   [OK]   %SKILL%
)
exit /b 0
