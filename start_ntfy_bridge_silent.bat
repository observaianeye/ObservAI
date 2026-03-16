@echo off
:: ObservAI ntfy.sh Bridge - Arka Planda Sessiz Çalıştır
:: Görev Çubuğunda görünmez, arka planda çalışır.
:: Windows Oturum Açıldığında Otomatik Başlatma için:
::   Win+R -> shell:startup -> Bu dosyayı oraya kopyala
cd /d "%~dp0"
start "" /min pythonw ntfy_bridge.py
echo ntfy bridge arka planda baslatildi.
echo Durdurmak icin: Gorev Yoneticisi > pythonw.exe > Gorevi Sonlandir
