# Faz 0 — Discovery Raporu

Tarih: 2026-04-28
Branch: refactor-partal (clean, origin ile aynı)

## Servisler


| Servis                | Port  | Durum    | Not                                                                                                                                                                                                                                                                                            |
| --------------------- | ----- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frontend (Vite)       | 5173  | UP (200) | `logs/frontend.log` eski EADDRINUSE içerir; yeni instance ayrı                                                                                                                                                                                                                                 |
| Backend API (Express) | 3001  | UP (200) | `/health` → `{status:healthy, database:connected}`. **Anomali:** ilk curl `{service:"MiroFish-Offline Backend"}` döndü, sonraki çağrı doğru ObservAI cevabı verdi → **muhtemel duplicate listener / port çakışması**, Faz 1'de doğrulanmalı. `logs/backend-api.log` EADDRINUSE içeriyor (eski) |
| Python Analytics      | 5001  | UP       | (yanıt aldı; camera-ai.log canlı `[DEMO] MiVOLO` logu üretiyor — kamera çalışıyor)                                                                                                                                                                                                             |
| Ollama                | 11434 | UP       | Modeller: `qwen2.5:14b`, `nomic-embed-text:latest` (qwen3:14b config'te ama listede yok → fallback'e düşebilir)                                                                                                                                                                                |


## Yüklü Skill'ler (kullanılacak)

### Test/Geliştirme (en kritik)

- `webapp-testing` → Playwright wrapper, E2E için Faz 1-4
- `test-driven-development` → her faz öncesi
- `verification-before-completion` → her faz sonu (kanıt-zorunlu)
- `systematic-debugging` → AI model + tracker hata avı (Faz 3)
- `requesting-code-review` → faz sonu
- `executing-plans`, `writing-plans`, `subagent-driven-development`, `dispatching-parallel-agents`
- `pair-programming` → driver/navigator + gerçek-zaman truth-score

### AI Model Test/Geliştirme (Faz 3 kritik)

- `claude-api` → Ollama/Gemini fallback testleri, prompt cache, model migration
- `agentdb-vector-search` + `agentdb-optimization` → embedding/HNSW perf testi
- `reasoningbank-intelligence` + `reasoningbank-agentdb` → adaptive learning, trajectory tracking, pattern recall
- `v3-performance-optimization` → Flash Attention, 150x search hedefleri, benchmark suite
- `agentdb-learning` → 9 RL algoritması (Decision Transformer, Q-Learning…) → demografi temporal smoothing tuning'e fayda
- `swarm-orchestration` + `swarm-advanced` → multi-agent test koordinasyonu (Faz 9)
- `verification-quality` → 0.95 truth threshold + auto-rollback

### Frontend / UI (Faz 8)

- `frontend-design` → distinctive prod-grade UI
- `web-design-guidelines` → a11y + design audit
- `theme-factory` → tema uygulama
- `vercel-react-best-practices`, `vercel-composition-patterns`, `vercel-react-view-transitions`
- `web-artifacts-builder` / `artifacts-builder` (yardımcı)

### Yardımcı

- `using-git-worktrees` → faz başına izole dal
- `changelog-generator`, `mcp-builder`, `skill-creator`, `skill-builder`
- `caveman:caveman-commit`, `caveman:caveman-review` → terse PR/commit
- `claude-flow:sparc:`* ailesi (architect/code/debug/tdd/security-review/optimizer)
- `claude-flow:hooks:`* ailesi (pre/post task/edit hooks)
- `claude-flow:analysis:performance-bottlenecks`, `monitoring:swarm-monitor`

### Eksik / İstenen Gruplar

- `engineering:`* — yok (genel skiller var ama bu prefix grup yok)
- `design:`*, `docx:*`, `pdf:*`, `xlsx:*`, `canvas-design:*` — yok
- Faz 5 export (PDF/CSV) için **pdf**/**xlsx** skill'leri eksik → manuel kütüphane kullanılacak (jsPDF, exceljs)

## Yüklü MCP'ler (kullanılacak)

`.mcp.json` ve deferred tool listesinden:

- `mcp__browsermcp__`* (BrowserMCP — Chrome) → **E2E her faz**: navigate, snapshot, screenshot, click, type, console_logs, wait
- `mcp__magic__21st_magic_component_builder|inspiration|refiner|logo_search` → **Faz 8 design polish** (API_KEY env gerekli, kontrol edilmeli)
- `mcp__claude_ai_Gmail`__* → Faz 6 email bildirim doğrulama (opsiyonel — gerçek gönderim test'i için sandbox)
- `mcp__claude_ai_Google_Drive_`_* → opsiyonel rapor paylaşımı
- `mcp__ide__executeCode`, `mcp__ide__getDiagnostics` → Faz 7 type/lint
- `claude-flow` MCP → swarm/agent/task orkestrasyonu (autoStart=false, manuel başlatılır)

## Eksik / Önerilen MCP'ler

- **Playwright MCP** — yok. Mevcut: `frontend/` içinde `@playwright/test` lokal kurulu (10 test, çalışır). BrowserMCP da Chrome-tabanlı E2E sağlıyor → **gerekli değil**, opsiyonel.
- **Prisma MCP** — yok. `npx prisma db execute` + python `sqlite3` ile DB doğrulanabiliyor → **gerekli değil**.
- **Slack MCP** — yok. Faz 6 staffing notification için Telegram + Email zaten yeterli.
- **Atlassian / Jira MCP** — yok, gerekmiyor (issue tracking GitHub).
- **computer-use MCP** — yok, BrowserMCP yetiyor.
- **scheduled-tasks MCP** — yok (`.claude/scheduled_tasks.lock` dosyası var ama MCP değil) → cron benzeri için claude-flow `automation:`* skiller var.

## Veri Tablosu (backend/prisma/dev.db)


| Entity              | Sayı        | Not                                                   |
| ------------------- | ----------- | ----------------------------------------------------- |
| users               | 19          | TRIAL=18, DEMO=1, PAID=0                              |
| sessions            | 219         | aktif/pasif ayrımı yapılmadı                          |
| branches            | 2           | —                                                     |
| cameras             | 10          | isActive=1: 5, isActive=0: 5                          |
| zones               | 30          | ENTRANCE=6, EXIT=1, QUEUE=6, TABLE=16, CUSTOM=1       |
| analytics_summaries | 22.753      | 2026-01-26 → 2026-04-27 (~91 gün, saatlik agregasyon) |
| analytics_logs      | 28.393      | ham metric stream                                     |
| chat_messages       | 35          | AI sohbet geçmişi                                     |
| insights            | 32          | ai-generated                                          |
| zone_insights       | 0           | **boş** — Faz 4'te seed gerekli                       |
| staff               | 4           | —                                                     |
| staff_assignments   | 3           | —                                                     |
| staff_shifts        | 0           | **boş** — Faz 6 testinde seed gerekli                 |
| notification_logs   | 3           | telegram/email log                                    |
| table_events        | 0           | **boş** — Faz 4 table state machine testinde dolacak  |
| password_resets     | (sayılmadı) | —                                                     |


## Model & Donanım

- **GPU**: NVIDIA GeForce RTX 5070, CUDA available=True (PyTorch)
- **yolo11l.pt**: 51.387.343 byte (~49 MB), mtime 2026-04-03 20:33
- **yolo11l.engine**: 53.323.226 byte (~50.8 MB), mtime 2026-04-07 00:23 → **derlenmiş, hazır**
- **trt_engine_cache/**: VAR, 5 farklı InsightFace ONNX subgraph engine + profile (sm120 = RTX 5070 SM, FP16) → InsightFace TRT EP cache hazır
- **Paket versiyonları** (camera-analytics venv):
  - `tensorrt-cu12=10.16.0.72`
  - `onnxruntime-gpu=1.24.2`
  - `insightface=0.7.3`
  - `ultralytics=8.4.18`

## Log Bulguları (kritik hatalar)

- `logs/backend-api.log` (1.2 KB, 2026-04-28 03:33): **EADDRINUSE :3001** → eski instance hâlâ portu tutuyordu, yeni başlatma reddedilmiş. Mevcut canlı backend muhtemelen ESKİ process. Faz 1'de temiz restart önerilir.
- `logs/frontend.log` (580 B, 2026-04-27): **Port 5173 already in use** → aynı durum.
- `logs/camera-ai.log` (22.6 MB, 2026-04-28 12:22, **canlı yazılıyor**): demografi pipeline çalışıyor, `MiVOLO: 2 faces, 2 matched, 4 results | YOLO=388ms Face=19ms MiVOLO=211ms` → MiVOLO entegrasyonu aktif (CLAUDE.md'de InsightFace yazıyor ama log MiVOLO diyor — dökümentasyon uyumsuzluğu, Faz 3'te incelenecek).
- `logs/camera-ai.log.err` (380 B, 2026-04-27 11:54): `forrtl: error (200): program aborting due to window-CLOSE event` (Intel Fortran runtime kapanma uyarısı, kritik değil — pencere kapanınca son sürüm Intel MKL).
- `logs/ollama.log`: GPU yüklü, qwen2.5:14b warmup başarılı, FlashAttention auto-enabled. Hata yok.
- `backend/logs/notification-dispatch.log`: 3 başarılı email dispatch ([femrepartal@gmail.com](mailto:femrepartal@gmail.com)), Telegram log yok → Telegram yapılandırılmamış olabilir, Faz 6'da kontrol.

## Git

- Branch: `refactor-partal`, origin ile senkron, **uncommitted yok**
- Son 10 commit:
  ```
  0ea62c9 chore(mcp): add Claude Flow + MCP setup files
  8e398a6 refactor(dashboard): merge Trends/AIInsights/Historical → AnalyticsPage
  baf243b docs(env): TOMTOM_API_KEY
  aa44b25 feat(traffic): location traffic congestion
  1152e29 feat(dashboard): compact demographics card
  efc0b3b refactor(dashboard): strip visitor arrows
  745f318 refactor: trim camera HUD chrome
  191a19f i18n: route Trends + Staffing through t()
  08ba13a refactor: surface backend errors + drop stale MJPEG keepalive
  a4be4da feat(analytics): per-page date range, 90-day cafe seed
  ```

## Test Altyapısı

- **backend vitest**: 41 test, **35 PASS / 6 FAIL** (2.24s)
  - **FAIL kümesi**: `src/__tests__/tables-ai-summary.test.ts` (6/6 fail) → `POST /api/tables/ai-summary` 500 dönüyor (beklenen 200). Hem fallback path hem `lang=en` path bozuk. **Faz 4 (Tables) blocker.**
  - PASS: auth, session, ai-chat-history, ai-config, analytics-validator, analytics-aggregator
- **python pytest**: **51 test toplandı** (test_metrics ailesi görünür: bucket_for_age, NumpyEncoder, BenchmarkMetrics serialization). Çalıştırılmadı, GPU markeri var (`@pytest.mark.gpu`).
- **frontend playwright**: **10 test, 4 dosya**
  - `auth-persistence.spec.ts` (2 test) — rememberMe restart, logout clears
  - `camera-sources.spec.ts` (5 test) — full CRUD + reuse + stream readiness
  - `real-time-dashboard.spec.ts` (1 test) — visitor count + demographics + dwell time
  - `smoke.spec.ts` (2 test) — landing + login route

## Sonraki Faz İçin Hazırlık

**Faz 1 öncesi yapılması gerekenler:**

1. Backend duplicate-listener anomalisi: `/health` iki farklı response veriyor → Task Manager'dan `node.exe` PID'lerini doğrula, ESKİ instance kill, temiz restart
2. `tables-ai-summary.test.ts` 6 fail → Faz 4 blocker, sebep ön-tarama: `tables.ts` route'unda 500 hatası (Ollama call mock'u uyumsuz olabilir)
3. Ollama'da `qwen3:14b` listede yok ama config primary; ya `OLLAMA_MODEL=qwen2.5:14b` env'i set edilmeli ya da `ollama pull qwen3:14b` yapılmalı (kullanıcı kararı)
4. zone_insights, table_events, staff_shifts boş tablolar → ilgili faz testinde seed scripti çağrılmalı (`npm run seed:history` benzeri)
5. CLAUDE.md "InsightFace" diyor, runtime log "MiVOLO" diyor → Faz 3 başında dokümantasyon hizalanmalı

**Eksik bağımlılıklar:** yok (tüm pip + npm + pnpm paketleri kurulu, GPU+TensorRT çalışıyor).

## Plan (16 fonksiyonel + 10 sorun → 9 faz)

1. **Faz 1** — Auth/Session/Branch/Settings (rememberMe, demo lock, branch CRUD, weather widget)
2. **Faz 2** — Camera & Streaming (CRUD, MJPEG inference vs smooth modu, FPS, reconnect)
3. **Faz 3** — AI Model Doğruluğu (kritik: YOLO + InsightFace/MiVOLO age/gender, BoT-SORT ID kararlılığı, demografik lock, ground-truth karşılaştırma)
4. **Faz 4** — Zones + Dashboard + Tables (zone CRUD/overlap, polygon/freehand, table state machine, dashboard real-time, **tables-ai-summary fix**)
5. **Faz 5** — Historical + Export + AI Chat (per-page date filter, Ollama/Gemini fallback, PDF/CSV export, chat history)
6. **Faz 6** — Staffing + Notifications + Insights (shift planner, Telegram + Email dispatch, peak demand, insight cron)
7. **Faz 7** — TR/EN i18n + Security (RBAC, JWT lifecycle, UTF-8 temizlik) + Infra + Coverage
8. **Faz 8** — Design polish (frontend-design + magic MCP)
9. **Faz 9** — Final dokuman derleme (her fazın raporu birleştirilir, PR + sürüm notu)

