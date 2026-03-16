@echo off
:: ObservAI ntfy.sh Windows Bridge - Autostart
:: Bu dosyayı çift tıklayarak ntfy bridge'i başlatabilirsiniz.
:: Arka planda çalışması için: start_ntfy_bridge_silent.bat dosyasını kullanın.

title ObservAI ntfy Bridge
echo ============================================
echo  ObservAI ntfy.sh Windows Bridge
echo ============================================
echo.
echo Bu pencere acik oldugu surece telefon bildirimleriniz calisir.
echo Kapatmak icin Ctrl+C basin.
echo.
cd /d "%~dp0"
python ntfy_bridge.py
pause
