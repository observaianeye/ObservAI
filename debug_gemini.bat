@echo off
chcp 65001 >nul
title ObservAI Debug
set PYTHONIOENCODING=utf-8
set PYTHONUTF8=1
cd /d "%~dp0"

echo ============================================
echo  ObservAI - Gemini Tani Testi
echo ============================================
echo.

echo [1] Python versiyonu:
python --version
echo.

echo [2] Gerekli paketler kontrol ediliyor...
python -c "import google.generativeai; print('  google-generativeai: YUKLU')" 2>nul || echo   google-generativeai: EKSIK - yukleniyor...
python -c "import google.generativeai; print('  google-generativeai: YUKLU')" 2>nul || pip install google-generativeai --quiet
python -c "import dotenv; print('  python-dotenv: YUKLU')" 2>nul || echo   python-dotenv: EKSIK - yukleniyor...
python -c "import dotenv; print('  python-dotenv: YUKLU')" 2>nul || pip install python-dotenv --quiet
echo.

echo [3] .env dosyasi okunuyor...
python -c "
from dotenv import load_dotenv
from pathlib import Path
import os
load_dotenv(Path('.env'))
key = os.getenv('GEMINI_API_KEY', '')
if key:
    print('  GEMINI_API_KEY: BULUNDU (' + key[:8] + '...)')
else:
    print('  GEMINI_API_KEY: BULUNAMADI!')
topic = os.getenv('NTFY_TOPIC', 'observai')
print('  NTFY_TOPIC: ' + topic)
"
echo.

echo [4] Gemini API test ediliyor...
python -c "
from dotenv import load_dotenv
from pathlib import Path
import os
load_dotenv(Path('.env'))
import google.generativeai as genai
key = os.getenv('GEMINI_API_KEY', '')
genai.configure(api_key=key)
model = genai.GenerativeModel('gemini-2.0-flash')
resp = model.generate_content('Say OK')
print('  Gemini yaniti: ' + resp.text[:50])
print('  BASARILI!')
" 2>&1
echo.

echo [5] ntfy.sh test bildirimi gonderiliyor...
python -c "
import urllib.request
req = urllib.request.Request(
    'https://ntfy.sh/observai',
    data=b'ObservAI debug testi - bu bildirim geliyorsa sistem calisiyor',
    headers={
        'Title': 'ObservAI Debug Test',
        'Priority': 'default',
        'Tags': 'test_tube',
    },
    method='POST'
)
with urllib.request.urlopen(req, timeout=10) as resp:
    print('  ntfy gonderildi! Status:', resp.status)
" 2>&1
echo.

echo ============================================
echo  Testi bitirince bu pencereyi kapat.
echo ============================================
pause
