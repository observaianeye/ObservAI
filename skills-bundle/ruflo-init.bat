@echo off
REM ============================================================
REM   RuFlo Init - ObservAI klasorunde calisir
REM   Cift tikla -> wizard'a baslar
REM ============================================================

cd /d "C:\Users\Gaming\Desktop\Project\ObservAI"
echo.
echo ============================================================
echo   RuFlo Init Wizard - ObservAI
echo ============================================================
echo.
echo   Wizard sana sorular soracak. Onerilen cevaplar:
echo.
echo   - LLM provider:        Anthropic Claude  (veya Ollama)
echo   - Workspace:           Mevcut dizin (varsayilan)
echo   - Topology:            hierarchical
echo   - Agent count:         6
echo   - Memory backend:      sqlite
echo   - Claude Code MCP:     Yes
echo   - Hooks:               Yes
echo.
echo   Eger Ollama secersen, su bilgileri verirsin:
echo     - URL:    http://localhost:11434
echo     - Model:  qwen3:14b
echo.
echo ============================================================
echo.
echo   Wizard baslatiliyor...
echo.
call npx -y ruflo@latest init --wizard
echo.
echo.
echo   Init tamamlandi. Ilk swarm icin:
echo     npx ruflo@latest swarm "Hello from ObservAI"
echo.
pause
