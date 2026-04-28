@echo off
REM ============================================================
REM   Eksik kalan 2 skill icin hizli retry
REM   (verify.bat [EKSIK] dedigi icin)
REM ============================================================

echo.
echo ============================================================
echo   Eksik skill retry: test-driven-development + skill-creator
echo ============================================================
echo.

set "SKILLS_DIR=%USERPROFILE%\.claude\skills"

echo [RETRY 1] obra/superpowers --skill test-driven-development
call npx -y skills add obra/superpowers --skill test-driven-development -g -a claude-code -y --copy
echo.

echo [RETRY 2] anthropics/skills --skill skill-creator
call npx -y skills add anthropics/skills --skill skill-creator -g -a claude-code -y --copy
echo.

echo ============================================================
echo Dogrulama:
echo ============================================================
if exist "%SKILLS_DIR%\test-driven-development\SKILL.md" (
    echo [OK] test-driven-development
) else (
    echo [HALA YOK] test-driven-development - manuel dene:
    echo   npx skills add obra/superpowers --skill test-driven-development -g -a claude-code -y --copy
)
if exist "%SKILLS_DIR%\skill-creator\SKILL.md" (
    echo [OK] skill-creator
) else (
    echo [HALA YOK] skill-creator - manuel dene:
    echo   npx skills add anthropics/skills --skill skill-creator -g -a claude-code -y --copy
)
echo.
pause
