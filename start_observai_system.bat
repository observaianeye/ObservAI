@echo off
:: ============================================================
:: ObservAI — Tam Otomatik Sistem Başlatıcı
:: ============================================================
:: Bu script şunları başlatır:
::   1. ntfy.sh Windows Bridge (arka planda, bildirimler için)
::   2. Orchestrator izleme (arka planda, HANDOFF otogüncelleme için)
::
:: Kullanım: Başlangıçta bir kez çalıştır, her şey otomatik olur.
:: Durdurmak için: Görev Yöneticisi > pythonw.exe > Görevi Sonlandır
:: ============================================================

cd /d "%~dp0"
echo.
echo ============================================================
echo  ObservAI Tam Otomatik Sistem Baslatiliyor
echo ============================================================
echo.

:: 1. ntfy.sh Bridge
echo [1/2] ntfy.sh Windows Bridge baslatiliyor...
start "" /min pythonw ntfy_bridge.py
echo       OK - Telefon bildirimleri aktif
echo.

:: 2. Orchestrator izleme modu (HANDOFF auto-update)
echo [2/2] Orchestrator izleme modu baslatiliyor...
start "" /min pythonw observai_orchestrator.py --monitor --interval 30
echo       OK - HANDOFF.md otomatik guncelleme aktif
echo.

echo ============================================================
echo  SISTEM HAZIR
echo ============================================================
echo.
echo  Her sey otomatik calisacak. Sadece bildirimler gelecek.
echo.
echo  Durumu gormek icin:
echo    python observai_orchestrator.py --status
echo.
echo  Bir sonraki AI'a gecmek icin:
echo    python observai_orchestrator.py --next-ai gemini
echo    python observai_orchestrator.py --next-ai cursor
echo.
echo  Durdurmak icin:
echo    Gorev Yoneticisi > pythonw.exe > Gorevi Sonlandir
echo ============================================================
echo.
timeout /t 5
