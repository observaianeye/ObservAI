"""ObservAI - Gemini Tani Testi"""
import sys, os
from pathlib import Path

print("=" * 50)
print(" ObservAI - Gemini Tani Testi")
print("=" * 50)
print()

# 1. Python
print(f"[1] Python: {sys.version}")
print()

# 2. Paketler
print("[2] Paketler:")
try:
    import google.generativeai
    print("  google-generativeai: YUKLU")
except ImportError:
    print("  google-generativeai: EKSIK!")
    print("  Cozum: pip install google-generativeai")

try:
    import dotenv
    print("  python-dotenv: YUKLU")
except ImportError:
    print("  python-dotenv: EKSIK!")
    print("  Cozum: pip install python-dotenv")
print()

# 3. .env dosyasi
print("[3] .env dosyasi:")
env_file = Path(__file__).parent / ".env"
if env_file.exists():
    print(f"  .env bulundu: {env_file}")
    try:
        from dotenv import load_dotenv
        load_dotenv(env_file)
    except Exception as e:
        print(f"  dotenv hatasi: {e}")
else:
    print("  .env BULUNAMADI!")

gemini_key = os.getenv("GEMINI_API_KEY", "")
ntfy_topic = os.getenv("NTFY_TOPIC", "observai")

if gemini_key:
    print(f"  GEMINI_API_KEY: BULUNDU ({gemini_key[:12]}...)")
else:
    print("  GEMINI_API_KEY: YOK! .env dosyasini kontrol et.")

print(f"  NTFY_TOPIC: {ntfy_topic}")
print()

# 4. Gemini API testi
print("[4] Gemini API testi:")
if not gemini_key:
    print("  Atlanıyor — key yok")
else:
    models = ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-2.0-flash-lite"]

    # Önce yeni paket dene
    success = False
    try:
        from google import genai
        client = genai.Client(api_key=gemini_key)
        print("  Yeni 'google.genai' paketi kullaniliyor")
        for m in models:
            try:
                resp = client.models.generate_content(model=m, contents="Say OK")
                print(f"  Model: {m}")
                print(f"  Yanit: {resp.text.strip()[:80]}")
                print("  GEMINI CALISIYOR!")
                success = True
                break
            except Exception as me:
                es = str(me)
                if "429" in es or "quota" in es.lower():
                    print(f"  {m}: Quota dolu, sonraki deneniyor...")
                else:
                    print(f"  {m}: HATA - {es[:100]}")
    except ImportError:
        print("  'google.genai' paketi yok, eski paket deneniyor...")

    if not success:
        try:
            import google.generativeai as genai_old
            genai_old.configure(api_key=gemini_key)
            print("  Eski 'google.generativeai' paketi kullaniliyor")
            for m in models:
                try:
                    model = genai_old.GenerativeModel(m)
                    resp = model.generate_content("Say OK")
                    print(f"  Model: {m}")
                    print(f"  Yanit: {resp.text.strip()[:80]}")
                    print("  GEMINI CALISIYOR!")
                    success = True
                    break
                except Exception as me:
                    es = str(me)
                    if "429" in es or "quota" in es.lower():
                        print(f"  {m}: Quota dolu, sonraki deneniyor...")
                    else:
                        print(f"  {m}: HATA - {es[:100]}")
        except Exception as e:
            print(f"  HATA: {e}")

    if not success:
        print()
        print("  TUM MODELLER QUOTA DOLU.")
        print("  Cozum: Gece yarisi sifirlanir, yarin calisir.")
        print("  VEYA: Yeni API key olustur -> https://aistudio.google.com/app/apikey")
print()

# 5. ntfy testi
print("[5] ntfy.sh testi:")
try:
    import urllib.request
    url = f"https://ntfy.sh/{ntfy_topic}"
    req = urllib.request.Request(
        url,
        data="ObservAI debug testi - sistem calisiyor!".encode("utf-8"),
        headers={
            "Title": "ObservAI Debug",
            "Priority": "default",
            "Tags": "test_tube",
        },
        method="POST"
    )
    with urllib.request.urlopen(req, timeout=10) as r:
        print(f"  Bildirim gonderildi! Status: {r.status}")
        print(f"  Telefonda '{ntfy_topic}' topic'ini kontrol et.")
except Exception as e:
    print(f"  HATA: {e}")
print()

print("=" * 50)
print(" Test bitti.")
print("=" * 50)
input("\nCikmak icin Enter'a bas...")
