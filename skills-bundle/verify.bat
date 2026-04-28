@echo off
REM ============================================================
REM   Skills Bundle Dogrulama
REM ============================================================

echo.
echo ============================================================
echo   ObservAI Skills Bundle - Dogrulama
echo ============================================================
echo.

REM Node kontrolu
where node >nul 2>nul
if errorlevel 1 (
    echo [HATA] Node.js yok
    pause
    exit /b 1
)
for /f "tokens=*" %%v in ('node --version') do echo [OK] Node.js %%v

REM Skills CLI
echo.
echo [Test 1] skills CLI calisiyor mu?
call npx -y skills --version 2>nul
if errorlevel 1 (
    echo   [HATA] skills CLI calismadi
) else (
    echo   [OK] skills CLI hazir
)

REM Global skills dizini
set "SKILLS_DIR=%USERPROFILE%\.claude\skills"
echo.
echo [Test 2] Global skill dizini: %SKILLS_DIR%
if not exist "%SKILLS_DIR%" (
    echo   [HATA] Dizin yok. install.bat'i calistir.
    pause
    exit /b 1
) else (
    echo   [OK] Var
)

REM Kurulu skiller
echo.
echo [Test 3] Kurulu skiller listesi:
echo ------------------------------------------------------------
call npx -y skills list -g 2>nul
echo ------------------------------------------------------------

REM Spesifik skiller
echo.
echo [Test 4] Kritik skiller mevcut mu?
call :CHECK_SKILL webapp-testing
call :CHECK_SKILL test-driven-development
call :CHECK_SKILL systematic-debugging
call :CHECK_SKILL writing-plans
call :CHECK_SKILL mcp-builder
call :CHECK_SKILL skill-creator
call :CHECK_SKILL changelog-generator

REM RuFlo
echo.
echo [Test 5] RuFlo CLI
where ruflo >nul 2>nul
if errorlevel 1 (
    echo   [INFO] ruflo global degil, npx ile calisir
    call npx -y ruflo@latest --version 2>nul
    if errorlevel 1 (
        echo   [HATA] npx ruflo calismadi
    ) else (
        echo   [OK]   npx ruflo hazir
    )
) else (
    for /f "tokens=*" %%v in ('ruflo --version 2^>nul') do echo   [OK] ruflo %%v
)

REM ObservAI .ruflo dizini
echo.
echo [Test 6] ObservAI'da RuFlo init edilmis mi?
if exist "C:\Users\Gaming\Desktop\Project\ObservAI\.ruflo\" (
    echo   [OK] .ruflo/ dizini mevcut
) else (
    echo   [INFO] .ruflo/ yok. Init icin:
    echo          cd C:\Users\Gaming\Desktop\Project\ObservAI
    echo          npx ruflo@latest init --wizard
)

echo.
echo ============================================================
echo   Dogrulama tamamlandi.
echo ============================================================
echo.
pause
goto :EOF


:CHECK_SKILL
set "SKILL_PATH=%SKILLS_DIR%\%~1"
if exist "%SKILL_PATH%\SKILL.md" (
    echo   [OK]   %~1
) else (
    echo   [EKSIK] %~1
)
exit /b 0
