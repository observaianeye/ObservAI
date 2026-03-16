@echo off
chcp 65001 >nul
:: ObservAI — Gemini ile tek görev çalıştır
:: Bu dosyayı Windows Task Scheduler'a ekle: her 45 dakikada bir
:: (Claude'un 30dk'lık döngüsüyle çakışmasın diye 45dk)

cd /d "%~dp0"
set PYTHONIOENCODING=utf-8
set PYTHONUTF8=1

echo [%DATE% %TIME%] Gemini ile gorev baslatiliyor... >> logs\gemini_scheduler.log

python observai_api_dev.py --ai gemini --once >> logs\gemini_scheduler.log 2>&1

echo [%DATE% %TIME%] Tamamlandi. >> logs\gemini_scheduler.log
