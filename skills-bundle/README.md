# ObservAI Skills Bundle

Claude Code + Cowork icin **kullanici-seviyesinde** kurulan skiller ve **RuFlo** multi-agent orchestration platformu.

> **ONEMLI:** Cowork ile Claude Code **AYRI** skill sistemleri kullaniyor. install.bat sadece Claude Code CLI tarafini kurar. Cowork'te "/" bastiginda skiller gormek icin **uygulamanin Directory ekranindan** "+" ile ekleme yapman lazim. Detay: `COWORK_VS_CLAUDE_CODE.md`

## TL;DR

```bat
:: Windows komut satirinda (Admin gerekmez)
cd C:\Users\Gaming\Desktop\Project\ObservAI\skills-bundle
install.bat
```

veya PowerShell:

```powershell
cd C:\Users\Gaming\Desktop\Project\ObservAI\skills-bundle
.\install.ps1
```

Bittikten sonra:

```bat
npx skills list -g          :: Kurulan skilleri listele
ruflo --version              :: RuFlo CLI calisiyor mu?
```

## Ne Kurulur?

Tum skiller `C:\Users\Gaming\.claude\skills\` altina kurulur. **Hesap degistirsen bile kalir** cunku Windows kullanicisina (OS user) bagli, Claude hesabina degil.

### Kurulan skill listesi (22 adet)

**Anthropic resmi (`anthropics/skills`):**
- `webapp-testing` - Playwright ile yerel web app testi (ObservAI frontend'in icin)
- `frontend-design` - React/UI design rehberi (CameraFeed.tsx refactor'u icin)
- `claude-api` - Anthropic SDK best practices (eger ileride Ollama yerine Claude API kullanirsan)
- `mcp-builder` - MCP server insasi (ObservAI Python analytics'i MCP olarak expose edebilirsin)
- `skill-creator` - ObservAI'ya ozel skill yazmak icin
- `web-artifacts-builder` - Cowork'te canli React artifact olusturma

**obra/superpowers (test + multi-agent + planning):**
- `test-driven-development` - Red-green-refactor disiplini
- `systematic-debugging` - "Bu staging'de calisiyor, prod'da calismiyor" senaryolari
- `subagent-driven-development` - Buyuk task'lari subagent'lara dagit
- `dispatching-parallel-agents` - Paralel ajan koordinasyonu (RuFlo ile mukemmel uyum)
- `writing-plans` - ObservAI ROADMAP.md adimlarini detayli plana cevir
- `executing-plans` - Plan -> commit -> test -> merge
- `verification-before-completion` - "Bittim" demeden once kanit
- `using-git-worktrees` - Paralel branch'lerde calisma
- `requesting-code-review` - PR icin yapisal review istegi
- `brainstorming` - Yeni feature fikirleri uretme

**ComposioHQ awesome-claude-skills:**
- `changelog-generator` - Release notes (ROADMAP adim tamamlamada otomatik)
- `file-organizer` - Repo temizligi (300+ dosyali ObservAI'da hayat kurtarir)
- `meeting-insights-analyzer` - Ekip toplanti notu sentezi
- `developer-growth-analysis` - Ekip code metric analizi
- `artifacts-builder` - HTML/SVG artifact insasi
- `content-research-writer` - Pazarlama yazisi (ObservAI demo materyali icin)

### RuFlo

`ruflo` global npm paketi olarak kurulur. ObservAI dizininde `npx ruflo@latest init --wizard` ile init edilebilir.

## Kapsam (Scope)

| Yontem | Sonuc |
|--------|-------|
| `npx skills add ... -g` | `~/.claude/skills/` (kullanici-global) — TUM Claude Code projelerinde + Cowork'te aktif |
| `npx skills add ... ` (proje icinde) | `.claude/skills/` (proje-local) — sadece o projede + git'e commit edilir |

**Bu paket -g kullanir.** Yani:
- Claude Code'u nereden acarsan ac, skiller hazir
- Cowork'te otomatik yuklenir
- Yeni proje baslat - skiller yine var
- Hesabini degistir - skiller hala orada (cunku OS user'a bagli)

## Test/Dogrulama

```bat
:: Skill listesi
npx skills list -g

:: Belirli bir skill'in icerigini gor
type "%USERPROFILE%\.claude\skills\webapp-testing\SKILL.md"

:: Claude Code'da skill aktivasyonu test et
claude
> "Webapp test for the staffing list page"
```

## Update / Maintenance

```bat
:: Tum globalleri en yeni surume yukselt
npx skills update -g -y

:: Sadece bir skill'i kaldir
npx skills remove -g -s webapp-testing
```

## ObservAI Kullanim Ornekleri

`USAGE_GUIDE.md` dosyasina bak — somut prompt ornekleri, RuFlo orchestration ornekleri, ROADMAP adimlarinda nasil kullanacagin.

## Sorun Giderme

**`npx skills` komutu bulunamiyor:**
- Node.js v18+ kurulu olmali. Versiyonu: `node --version`
- npx cache temizle: `npm cache clean --force`

**Skiller Claude Code'da gorunmuyor:**
- Claude Code'u kapat ve yeniden ac
- `npx skills experimental_sync` komutu ile zorla sync et

**RuFlo kurulumu hata veriyor:**
- Global npm install Admin yetkisi isteyebilir. Admin terminal ile dene:
  `npm install -g ruflo@latest --force`
- Veya hic kurmadan: `npx ruflo@latest init --wizard`

**Bir skill'i ObservAI'ya ozel yapmak istiyorum (ekip ile paylasilsin):**
- Global yerine proje-local kur:
  ```
  cd C:\Users\Gaming\Desktop\Project\ObservAI
  npx skills add anthropics/skills --skill webapp-testing
  ```
  Bu `.claude/skills/` altina kurar, git'e commit edersin, ekip de gorur.
