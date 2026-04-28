# ObservAI Skills - Kullanim Rehberi

Bu rehber, kurulan 22 skill + RuFlo'nun **ObservAI projesinde** nasil kullanilacagini gercek prompt ornekleri ile gosterir.

---

## 1. Genel Calisma Prensibi

Skiller **otomatik olarak** Claude tarafindan yuklenir — sen sadece dogru kelimeleri kullan, Claude SKILL.md'yi okuyup en iyi sekilde davranir.

| Yapma | Yap |
|-------|-----|
| "Bu skill'i kullan: webapp-testing" | "Staffing sayfasinin Playwright testlerini yaz" |
| "TDD skill'ini cagir" | "ZoneCanvas.tsx icin test-first yaklasimi ile bir bug fix yap" |

Skiller ARKA PLANDA calisir — adlarini ezberleme zorunda degilsin, ne istedigini soyle.

---

## 2. ObservAI'a Spesifik Kullanim Senaryolari

### 2.1. Test/QA — `webapp-testing` + `test-driven-development` + `verification-before-completion`

**ROADMAP'taki herhangi bir test isi:**

```
ObservAI staffing sayfasinda yeni "Vardiya Atama" formunu Playwright ile test et.
TDD yaklasimi kullan: once failing test yaz, sonra component'i implement et.
Verification: testler gercekten cre yapilan field'lari kontrol etsin, sadece "page loads" demesin.
```

Claude su skilleri otomatik aktifleştirir:
- `webapp-testing` (Playwright + with_server.py — frontend'i otomatik baslatir)
- `test-driven-development` (red-green-refactor)
- `verification-before-completion` (testlerin gercekten anlamli olmasini saglar)

**Yararli olur cunku:**
- ObservAI frontend'i test calistirmadan once `pnpm dev`'i baslatmasi lazim — `with_server.py` bunu otomatik yapar
- TDD ile yeni feature'lar regression yaratmaz
- Verification-before-completion "yesil testlerim ama hicbir sey kontrol etmiyor" tuzagini engeller

### 2.2. Buyuk Refactor — `subagent-driven-development` + `dispatching-parallel-agents` + RuFlo

**CameraFeed.tsx 1400 satir** — refactor zamani:

```
CameraFeed.tsx'i daha kucuk component'lara bol:
- VideoStream (MJPEG render)
- WebSocketBridge (canli veri)
- ZoneOverlay (cizim katmani)
- StatsPanel (alt panel)

Her parcayi ayri subagent'a yaptır, sonunda hepsi entegre olsun.
Verification: 4 component'in import'lari dogru, mevcut testler hala gecmeli.
```

Claude:
- `subagent-driven-development` ile gorevi 4 paralel subagent'a dagitir
- `dispatching-parallel-agents` koordinasyonu yapar
- `verification-before-completion` ile her subagent'in cikitisini test eder

**RuFlo entegrasyonu (daha agresif paralelizasyon):**

```bat
cd C:\Users\Gaming\Desktop\Project\ObservAI
npx ruflo@latest swarm "CameraFeed.tsx refactor" --topology hierarchical --agents 5
```

RuFlo 5 ajan acar (architect, 4 coder), her biri bir component'a baslar, RuFlo memory ile state'i paylasir, sonunda 1 reviewer hepsini birlestirir.

### 2.3. ROADMAP Adim Yonetimi — `writing-plans` + `executing-plans` + `changelog-generator`

ObservAI'nin `ROADMAP.md` dosyasi var. Yeni adim baslatma:

```
ROADMAP.md'deki ADIM 18 "Sube Bazli Heatmap Analizi" icin detayli plan yaz.
Plan: hangi dosyalar degisecek, hangi yeni componentler, DB schema migration var mi,
test plani, rollback stratejisi.
```

Claude `writing-plans` skill'i ile yapisal bir plan uretir. Sonra:

```
Plani onayladim. ADIM 18'i adim adim execute et. Her komut basamaginda commit at.
Bittikten sonra changelog-generator ile bu adim icin release notu olustur.
```

Claude:
- `executing-plans` ile adimlari sirayla calistirir
- Her sub-task icin commit acar
- Bitirince `changelog-generator` ile `CHANGELOG.md`'ye giris ekler

### 2.4. Bug Hunting — `systematic-debugging` + `using-git-worktrees`

```
Production'da Python analytics 5 dakika sonra OOM yapip crash ediyor.
Local'de tekrar uretemiyoruz. Systematic debug et:
- Repro icin minimum case
- Memory profiling (memory_profiler)
- Suspect siralamasi
- Hipotezi nasil dogrulayacagimiz

Ayrica using-git-worktrees ile main'i bozmadan ayri worktree'de calismayi planla.
```

Claude:
- `systematic-debugging` cerceve kullanir (reproduce, isolate, diagnose, fix)
- `using-git-worktrees` ile bug-hunt-oom-2026-04 branch'inde ayri worktree acar
- Ana branch'in akisini bozmaz

### 2.5. MCP Server Insasi — `mcp-builder`

ObservAI Python analytics'i Claude Code'a/Cowork'e MCP server olarak expose etmek istiyorsan:

```
ObservAI Python backend'inde calisan kamera analytics'i MCP server olarak expose et.
Tools:
- get_current_zone_counts(camera_id)
- get_demographic_summary(time_range)
- query_visitor_history(start, end, zones)

mcp-builder skill'ine gore yapisal bir MCP server yaz, schema doc + example client.
```

Claude `mcp-builder` skill'inden tum protokolu okur, dogru sekilde implement eder. Sonuc: `packages/camera-analytics/mcp_server.py` — Cowork'e tanit, ObservAI verilerini direkt sorabilirsin.

### 2.6. Frontend Design Audit — `frontend-design` + `webapp-testing`

```
ObservAI frontend dashboard'unun tasarim tutarliligini denetle:
- TopNavbar, sub-tabs, footer renk paleti
- Spacing patterns (8px / 16px / 24px tutarli mi?)
- Tipografi hierarchy (H1, H2, body)
- Dark mode kontrastlari (WCAG AA)
- Mobile breakpoint davranisi

frontend-design skill'inin checklist'i ile gec, screenshot al webapp-testing ile.
```

### 2.7. Toplanti Sentezi — `meeting-insights-analyzer`

Ekibin sprint planning toplantisindan sonra (notlar elindeyse):

```
Asagidaki sprint planning notlarini analiz et. Action items'lari kim'e atanmis,
ne zamana kadar, hangileri ROADMAP.md'ye yansimali, hangileri bekleyebilir.

[notlari yapistir]
```

Claude `meeting-insights-analyzer` skill'i ile bunu yapisal bir actionable list'e cevirir. Daha sonra `ROADMAP.md`'ye otomatik yansitabilir.

### 2.8. Dosya Temizligi — `file-organizer`

ObservAI 300+ dosyali bir repo. Periodik temizlik:

```
ObservAI repo'sunu denetle:
- Kullanilmayan eski Python dosyalari (1 ayda hic import edilmemis)
- Duplicate component'ler
- frontend/dist veya backend/build gibi git'e gitmemesi gerekenler
- TODO kalmis ama 6 aydan eski commentler
- Eski test fixture'lari

file-organizer skill'i ile yapisal rapor cikar, sonra benimle onaya gel temizlemeden.
```

### 2.9. Yeni Skill Olusturma — `skill-creator`

ObservAI'ya OZEL bir is akisi varsa (mesela "Yeni kamera ekle" wizard'i hep ayni 8 adimi gerektirir), kendi skill'ini olustur:

```
ObservAI icin "add-camera" adinda bir skill olustur:
1) Sube sec
2) Kamera URL test et (RTSP veya YouTube)
3) Default zone configuration olustur
4) Python analytics'i restart et
5) Frontend'de yeni kamera kaydi yap
6) MJPEG test ile dogrula

skill-creator skill'i ile SKILL.md yaz, scripts/ klasoru ekle.
Sonra global'e -g flag ile kur, ekip de kullanabilsin.
```

Claude `skill-creator` rehberini takip eder, hazir bir skill cikartir, sen `npx skills` ile global'e atarsin.

---

## 3. RuFlo Orchestration — Detayli Kullanim

RuFlo Claude Code'un uzerinde calisir, multi-agent koordinasyon saglar.

### Init (ObservAI klasorunde tek seferlik)

```bat
cd C:\Users\Gaming\Desktop\Project\ObservAI
npx ruflo@latest init --wizard
```

Wizard sana sorar:
- Hangi LLM provider? (Claude, Ollama lokal — ObservAI'nin Ollama'si zaten var)
- Hangi agent rolleri? (coder, tester, reviewer, architect, security, ...)
- Topology? (hierarchical / mesh / star)
- Memory backend? (sqlite / vector)

ObservAI icin onerim: `hierarchical` topology + Claude provider + 6 agent (architect, 2 coder, tester, reviewer, security).

### Komut ornekleri

**Tek komutla complex feature:**
```bat
npx ruflo@latest swarm "Sube bazli heatmap raporu API + frontend + DB migration"
```
RuFlo otomatik olarak:
1. Architect agent: ADR yazar
2. DB agent: Prisma migration yazar
3. Backend agent: REST endpoint
4. Frontend agent: React component
5. Tester agent: hem backend hem frontend testleri
6. Reviewer agent: hepsini bir araya getirir, PR mesaji yazar

**Performans audit:**
```bat
npx ruflo@latest audit performance
```
Tum kod tabanini gezer, N+1 query, memory leak, gereksiz re-render, FPS bottleneck ariyor.

**Continuous learning:**
```bat
npx ruflo@latest hooks intelligence --status
```
RuFlo zaman icinde hangi agent kombinasyonunun ObservAI tipi gorevlerde basarili oldugunu ogrenir.

### Claude Code icinde RuFlo MCP olarak kullanim

`ruflo init` MCP server konfigurasyonunu da olusturur (`.mcp.json`'a ekler). Boylece Claude Code'da:

```
> Bana ObservAI ROADMAP'inde 5 paralel adim secmek istedigim varsay,
  hepsini RuFlo swarm'a dagit, durumu izle, bittikce bana raporla.
```

Claude RuFlo MCP tool'larini cagirir, sen Claude'la konusurken arkada 5 RuFlo agent'i ayri tasklarda calisir.

---

## 4. Cowork Mode'da Skiller

Cowork mode'da skill'ler otomatik tetiklenir. Ornek:

**Sen yazıyorsun:**
> ObservAI son 7 gunluk ziyaretci datasindan bir rapor pdf'i hazirla, ekibe email at.

**Cowork arka planda:**
1. `pdf` skill'i tetiklenir (rapor olustur)
2. `webapp-testing` skill'i tetiklenir (canli verileri ObservAI'dan ceker)
3. `xlsx` skill'i tetiklenir (yan tabloyu da olustur)
4. Email connector ile gonderir

Sen sadece dogal dilde isteği yazıyorsun. Skiller Claude'in nasil davranacagini sekillendirir.

---

## 5. En Etkili Prompt Pattern'leri

### Pattern 1: Goal + Constraints + Verification

```
GOAL: ObservAI'da gece modu (dusuk isik) icin demografi confidence threshold'u optimize et.
CONSTRAINTS: 
- yolo11l.pt modeline dokunma
- default_zones.yaml uzerinden config update et
- Mevcut testler hala gecmeli
VERIFICATION:
- packages/camera-analytics/tests altinda yeni test ekle
- Synthetic gece dataseti ile age_mae < 5, gender_f1 > 0.85 ispatla
```

### Pattern 2: Explore -> Plan -> Execute

```
1) Explore: ObservAI'da analytics aggregation nasil calisiyor anla,
   /backend/src/services/analyticsAggregator.ts'i oku, prisma schema'yi gec.

2) Plan: Saatlik aggregation'a "yas grubu kirilim"i eklemek icin yapisal plan yaz.
   Hangi DB column'lari, hangi index, migration script.

3) Execute: Plani onayladiktan sonra adim adim implement et, her adimda commit at.
```

### Pattern 3: Multi-agent (RuFlo)

```
RuFlo swarm baslat, gorev: "ObservAI auth flow'u JWT + refresh token + rotation patterni
ile guvenli hale getir". 

Agent dagılımı:
- security agent: tehdit modeli + threat-modeling.md yaz
- backend agent: refresh token endpoint + middleware
- frontend agent: auto-refresh hook + interceptor
- tester agent: integration test + e2e
- reviewer agent: hepsini birlestirip PR olustur
```

---

## 6. Skill Listesi - Hizli Referans

| Skill | Tetikleyici Anahtar Kelimeler | ObservAI Kullanim Ornegi |
|-------|------------------------------|--------------------------|
| webapp-testing | "Playwright", "test sayfasi", "frontend test" | Staffing form testleri |
| frontend-design | "design audit", "UI tutarliligi" | CameraFeed renk/spacing |
| claude-api | "Anthropic SDK", "prompt caching" | Ileride Ollama'dan Claude'a gecis |
| mcp-builder | "MCP server", "Claude'a tool" | Python analytics MCP wrapper |
| skill-creator | "yeni skill yaz", "kendi skill'im" | "add-camera" wizard skill'i |
| web-artifacts-builder | "live HTML", "Cowork artifact" | ObservAI dashboard mockup |
| test-driven-development | "TDD", "red-green-refactor" | ZoneCanvas yeni feature |
| systematic-debugging | "bug bul", "production'da crash" | OOM root cause analizi |
| subagent-driven-development | "buyuk task'i bol" | CameraFeed.tsx refactor |
| dispatching-parallel-agents | "paralel calistir" | 5 component ayri subagent |
| writing-plans | "detayli plan yaz" | ROADMAP adimi planlamasi |
| executing-plans | "plani uygula" | ROADMAP adim execute |
| verification-before-completion | "kanit ver" | "testlerim gercek mi anlamli?" |
| using-git-worktrees | "ayri worktree" | bug-hunt branch izolasyonu |
| requesting-code-review | "PR review iste" | Pre-merge review hazirlik |
| brainstorming | "fikir uret" | Yeni demo feature beyin firtinasi |
| changelog-generator | "release notes" | ROADMAP adim tamamlama |
| file-organizer | "repo temizligi" | 300+ dosya audit |
| meeting-insights-analyzer | "toplanti notlari" | Sprint planning sentezi |
| developer-growth-analysis | "ekip code metric" | Ekip review |
| artifacts-builder | "static artifact" | Demo HTML page |
| content-research-writer | "blog yazisi", "demo materyali" | ObservAI satis broşürü |

---

## 7. Skill'leri Daha Iyi Hale Getirme

Bir skill ObservAI'a tam uymuyorsa:
1) Skill icerigini gor: `type "%USERPROFILE%\.claude\skills\<skill>\SKILL.md"`
2) ObservAI'a ozel guncellemeleri `~/.claude/CLAUDE.md` (kullanici-global) veya proje `CLAUDE.md`'ye ekle.
3) Tamamen yeni bir skill istersen: `skill-creator` skill'ini kullan.

---

## 8. Onemli Notlar

- **Update:** `npx skills update -g -y` ile periyodik guncelle (ayda bir).
- **Conflict:** Iki skill ayni dosyaya dokunmaz ama ayni patterni farkli onerirse Claude sana sorar.
- **Performance:** 22 skill cok degil — Claude SADECE relevant skilleri yukler, hepsini context'e koymaz.
- **Privacy:** Kurulu skiller telemetriye dahil olabilir (skills.sh leaderboard). Hassas durumda `--no-telemetry` flag'i kullan.

---

## 9. Sorun Giderme

```bat
:: Skill'ler gorunmuyor mu?
npx skills experimental_sync

:: Bozuk skill'i sil
npx skills remove -g -s <skill-adi>

:: Tum globalleri yeniden kur
install.bat

:: Sadece RuFlo'yu reinit
npx ruflo@latest init --wizard --force
```

---

Bu rehber sabit degil — kendi prompt pattern'lerini kesfettikce alt'a ekle. Iyi calismalar.
