@echo off
chcp 65001 >nul
title ObservAI — Otonom Geliştirme Sistemi

echo.
echo  ╔══════════════════════════════════════════════╗
echo  ║   ObservAI — Otonom AI Gelistirme Sistemi   ║
echo  ║   Claude → Gemini → OpenAI otomatik gecis   ║
echo  ╚══════════════════════════════════════════════╝
echo.

:: ObservAI klasörüne git
cd /d "%~dp0"

:: .env dosyası var mı kontrol et
if not exist ".env" (
    echo [HATA] .env dosyasi bulunamadi!
    echo.
    echo  Simdi olusturuyorum...
    copy .env.example .env >nul
    echo  .env dosyasi olusturuldu.
    echo.
    echo  YAPMAN GEREKEN:
    echo    1. .env dosyasini Not Defteri ile ac
    echo    2. API key'lerini gir ve kaydet
    echo    3. Bu bat dosyasini tekrar calistir
    echo.
    notepad .env
    pause
    exit /b 1
)

:: Python bağımlılıklarını kontrol et / yükle
echo [1/3] Python bagimliliklar kontrol ediliyor...
python -c "import anthropic, dotenv" 2>nul
if %errorlevel% neq 0 (
    echo      Eksik paketler yukleniyor...
    pip install anthropic google-generativeai openai python-dotenv --quiet
    if %errorlevel% neq 0 (
        echo [HATA] pip install basarisiz. Python ve pip yuklu mu?
        pause
        exit /b 1
    )
)
echo      OK

:: API bağlantılarını test et
echo [2/3] API baglantilari test ediliyor...
python observai_api_dev.py --test-apis
if %errorlevel% neq 0 (
    echo.
    echo [HATA] API testi basarisiz. .env dosyasindaki key'leri kontrol et.
    pause
    exit /b 1
)

:: Sistemi başlat
echo [3/3] Sistem baslatiliyor...
echo.
echo  ntfy.sh bildirimleri: https://ntfy.sh/%NTFY_TOPIC%
echo  iPhone'unda ObservAI topic'ini takip et.
echo.
echo  Durdurmak icin: CTRL+C
echo.

:: Arka planda ntfy bridge'i başlat (varsa)
if exist "ntfy_bridge.py" (
    start /min "ObservAI-Bridge" python ntfy_bridge.py
    echo  [ntfy bridge arka planda calisiyor]
)

:: Ana orkestratörü başlat
python observai_api_dev.py

echo.
echo Sistem durduruldu.
pause
