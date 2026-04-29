# Changelog

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## [1.0.0] — 2026-04-29

First production release. Faz 0–9 implementation tamamlandı; 60/61 yan kapatildi (1 KEEP, 6 Faz 10 backlog).

### Highlights

- **Real-time camera analytics**: YOLO11L person detection (TensorRT FP16) + InsightFace face detection (CUDA EP) + MiVOLO age/gender (Torch CUDA) + BoT-SORT tracking, 3-thread async pipeline ~25 FPS @ 1080p RTX 5070.
- **Multi-tenant SaaS auth**: cookie session JWT + branch-scoped RBAC (ADMIN/MANAGER/ANALYST/VIEWER) + soft-revoke session model, 14-day TRIAL + paid tier + DEMO walkthrough.
- **Production-grade security**: Yan #37 chat tenant leak rejection (USER_MESSAGE boundaries + branchId-scoped getRecentAnalyticsContext) verified in 7 consecutive leak probes (LEAK_COUNT=0 each).
- **Bilingual TR/EN**: 200+ i18n keys with diacritic-correct Turkish (Şube/şube, sayfası, etc.), email templates, export labels, weather codes, Settings UI, chat responses.

### Added

- **Yan #22**: Python `NodePersister` (asyncio batched POST + retry exp backoff) + Node `POST /api/analytics/ingest` (X-Ingest-Key auth) for frontend-independent analytics persistence.
- **Yan #31** (Faz 8): Real polygon-polygon zone overlap (bbox quick-reject + edge-edge proper intersection + vertex containment); convex AND concave polygons; touching adjacency allowed. +5 vitest.
- **Yan #39** (Faz 8): Custom date range overview (`?range=custom&from=ISO&to=ISO`, 365d cap server-side); native HTML5 date picker; DashboardFilterContext persists via localStorage. +4 vitest.
- **Yan #44** (Faz 7E): Insights cron `setInterval(6h)` + idempotent `(cameraId, type, dateKey)` upsert; opt-in via `INSIGHT_CRON_ENABLED=true`.
- **Yan #57** (Faz 7E): Insights `PATCH /:id/dismiss` + `dismissedAt` schema; default `GET /api/insights` filters dismissed; `?includeDismissed=true` for audit view.
- **Yan #59** (Faz 7D): Staff assignment accept/decline tokens with 48h TTL + idempotent replay (404 → 410 → 200 happy / replay).
- **Yan #38** (Faz 7E): Dashboard date range persists in `DashboardFilterContext` + localStorage so navigating Analytics → Tables → Analytics keeps the user's selection.
- **Yan #50** (Faz 7E): MJPEG eligibility auto-attaches when Python pipeline is live (no need for `STREAMING_ACTIVE_KEY` flag on fresh login).
- **Yan #51** (Faz 7E): ZoneCanvas DrawMode audit + `data-testid` for e2e maintainability.
- **Yan #56** (Faz 7C + 8B5): GlobalChatbot `markdownLite` renderer — bold/italic + inline `code` + bare URL auto-link, all XSS-escape-first; +6 frontend node:test (3 base + 3 polish).
- **echarts theme** (Faz 8B3): `lib/echartsTheme.ts` `observai` palette (tailwind-aligned brand/violet/accent), registered at app startup; AnalyticsPage timeline + prediction + DwellTimeWidget chart all themed.
- **README v1.0.0 production deploy section** with required env vars, opt-in flags, and known Faz 10 backlog.
- **`test-results/_MASTER-final-report.md`** — single-stop release artifact (executive summary, per-faz overview, full yan table, production readiness checklist, known leftovers).

### Changed

- **Notification dispatch is email-only** (Yan #58, Faz 9). `telegramService.ts` removed; `notificationDispatcher` now only sends via Nodemailer. `Staff.telegramChatId` retained as legacy column (drop migration in Faz 10 backlog).
- **Polygon-polygon overlap replaces bbox-only AABB** in `backend/src/routes/zones.ts` and `frontend/src/components/camera/ZonePolygonUtils.ts`. U-shape false positive (bbox overlap, interior disjoint) and adjacent-zone false positive (shared edge) both resolved.
- **`OLLAMA_MODEL` exact match** (Yan #36, Faz 7D): no longer accepts variant suffixes. `llama3.1:8b` env now selects `llama3.1:8b`, not `llama3.1:8b-8k`.
- **Aggregator timezone-aware** (Yan #45, Faz 7A): `analyticsAggregator.ts` resolves each camera's branch tz (fallback Europe/Istanbul) via `Intl.DateTimeFormat`-only impl (no extra date-fns-tz dep).
- **CSV/PDF export locale-aware** (Yan #41, Faz 7C): TR (`Tarih`/`Kamera`) vs EN (`Timestamp`/`Camera`) labels resolved from `?lang=`/`req.user.locale`/`Accept-Language` chain; PDF strips diacritics for Helvetica compatibility.
- **Export filenames branch + camera slugged** (Yan #42, Faz 7F): `<branchSlug>_<cameraSlug>_<existingStem>.csv|pdf`.
- **Email templates bilingual** (Yan #10, Faz 7C): password reset email picks TR or EN based on `Accept-Language`.
- **Weather widget code mapping** (Yan #11, Faz 7C): Open-Meteo numeric codes resolved through semantic enum (`clear|partly|cloudy|fog|rain|snow|storm`) → i18n.
- **Branch switch debounced 300ms** (Yan #19, Faz 7F) in `TopNavbar`.
- **Backfill seed daily = SUM(hourly)** (Yan #25, Faz 7F): scripted seed reads back persisted hourly rows and aggregates SUM/MAX directly; eliminates 1.42x daily/hourly drift (3.7c sample-camera-1 case).
- **`makeTimeAgo` lifted to `lib/relativeTime.ts`** (Faz 8B6) so future Insight / activity surfaces share a single i18n contract (`common.justNow`/`minutesAgo`/`hoursAgo`/`daysAgo`).
- **CLAUDE.md docs** updated for: MiroFish port collision (Yan #20), test fixture aspirational status (Yan #21), Telegram cleanup (Yan #58), staffing AI summary clarification (Yan #60), 3.7c daily idempotency closure, 3.8 InsightFace + MiVOLO dual provider documentation.

### Fixed

- **Yan #37 chat tenant leak (CRITICAL)**: production verified CLOSED. Admin-issued conversationId reused by deneme tenant returns 0 leakage from prior history (7 consecutive sessions, including Faz 7-8-9 every regression gate).
- **Yan #30 lowercase 'table' typo** (Faz 7A): Prisma enum is uppercase; `tables.ts:246` `type: 'table'` → `type: 'TABLE'` so manual override fix correctly persists. +3 vitest.
- **Yan #34 UTF-8 input rejection** (Faz 7A+C): pure-JS `isUTF8` zod refine on zones / branches / staff / cameras name inputs; rejects `Sub�e` (lone replacement char) before the bad byte sequence reaches Prisma. +6 vitest.
- **Yan #54 Cape Town TZ DB row** (Faz 7A): `Asia/Dubai` corrected to `Africa/Johannesburg` via idempotent script.
- **Yan #2 register firstName/lastName/companyName** (Faz 7F): legacy `name` split fallback retained for back-compat. +3 vitest.
- **Yan #3 sessions revokedAt** (Faz 7F): logout sets `revokedAt` instead of deleting; authenticate middleware rejects revoked sessions; preserves audit trail. +3 vitest.
- **Yan #5 weather 10min cache** (Faz 7F): in-process `Map<branchId:lat:lng, {data, expiresAt}>`; `X-Weather-Cache: HIT|MISS` header; protects Open-Meteo from rate-limit.
- **Yan #6 notification audit log** (Faz 7F): all dispatch paths (alert + password reset) now write `backend/logs/notification-dispatch.log`; previously only `staff_shift` events logged.
- **Yan #14 branch-yok kamera UI submit disabled** (Faz 7F): button `disabled` + tooltip when no branch selected.
- **Yan #28 timestamp birim** (Faz 7D): seconds-vs-ms guard in `analyticsValidator` (`< 1e12` rejected with explicit message); idempotent normalize script for any historical drift (live audit: 0 rows).
- **Yan #32 polygon corner cap max(128)** (Faz 7F): `CreateZoneSchema.coordinates` `min(3).max(128)`. +3 vitest.
- **Yan #46 chat branchId multi-cam aggregate** (Faz 7D): `/api/ai/chat` accepts `branchId` for multi-camera aggregate context; tenant scope verified via `userOwnsBranch`. +3 vitest.
- **Yan #47 prompt injection escape + USER_MESSAGE boundaries** (Faz 7D): `lib/promptSanitizer.ts` strips role tags, escapes triple-backticks, truncates at 4000 char, wraps in `<USER_MESSAGE>...</USER_MESSAGE>`. +7 vitest.
- **Yan #48 callOllama empty response throw + Gemini fallback** (Faz 7D): empty `data.response.trim()` throws `OLLAMA_EMPTY_RESPONSE` so Gemini fallback fires naturally. +4 vitest.
- **Yan #49 chat_messages userId NULL cleanup** (Faz 7F): one-shot script deleted 4 orphan rows; idempotent re-run (`Found 0`).
- **Yan #52 helpers/db.ts BigInt** (Faz 7F): JSON.stringify reviver downcasts `bigint → Number` so SQLite INTEGER wide-column reads don't crash the e2e helper.

### Security

- **Multi-tenant chat isolation** (Yan #37): conversationId no longer authoritative for context retrieval; admin chat history never leaks to deneme tenant on shared id (verified 7×).
- **Prompt injection guard**: `lib/promptSanitizer.ts` (Yan #47) wraps user message in role-tag boundaries before Ollama/Gemini call.
- **Session revocation** (Yan #3): logout creates a server-side `revokedAt` audit trail; replay attempts return 401 explicitly.
- **UTF-8 input validation** (Yan #34): pure-JS `isUTF8` zod refine across zones / branches / staff / cameras; rejects U+FFFD and lone surrogates before Prisma write.
- **Polygon corner cap** (Yan #32): max 128 vertices per zone polygon caps Prisma payload + ray-cast loop cost.

### Deprecated

- `backend/src/services/telegramService.ts` — file removed (Yan #58, Faz 9). `notificationDispatcher` now email-only.
- `Staff.telegramChatId` Prisma column — retained as NULL legacy column; drop migration in Faz 10 backlog.

### Removed

- Bbox-only `rectsOverlap` in `backend/src/routes/zones.ts` (replaced by `polygonsOverlap`, Yan #31).

### Known Issues / Faz 10 Backlog

- **Yan #4.4 tables-ai-summary 6/6 expected FAIL (KEEP)** — mock parser fixture; prod path PASS.
- **Yan #21 test fixture infrastructure** — `tests/fixtures/mozart_cafe_*_short.mp4` + `ground_truth.json` annotation never landed; LFS strategy decision pending.
- **Yan #60 staffing AI summary** — option B doc cleanup applied; if product re-prioritises, implement `POST /api/staffing/summary` (tables.ts pattern, 30s Ollama throttle).
- **4K perf optimisation** — 3 perf FAIL on 4K source (Faz 2); 1080p prod-ready, 4K future opt.
- **Live `runDailyAggregationFor()` re-aggregate-each-tick** — seed path closed (Yan #25); live path background work for Faz 10 (3.7c #24).
- **UX rework** — BranchSection card grid + accordion chevron + Bildirimler/Kanallar merge (Yan #1.4); InsightCard component animated dismiss + dateKey badge — Magic MCP brainstorming pass needed.

### Migration Notes

`prisma migrate deploy` runs 4 new migrations relative to pre-Faz 7 baseline:
- `20260429000000_yan_59_accept_token_expiry` (StaffAssignment.acceptedAt + acceptTokenExpires)
- `20260430000000_yan_44_insight_idempotency` (Insight.dateKey + UNIQUE(cameraId, type, dateKey))
- `20260430010000_yan_57_insight_dismiss` (Insight.dismissedAt)
- `20260501000000_yan_3_session_revoked_at` (Session.revokedAt)

If migrations diverge from `_prisma_migrations` history (raw ALTER TABLE in earlier batches), use `prisma migrate resolve --applied <name>` to reconcile before deploy.

---

[1.0.0]: https://github.com/observaianeye/ObservAI/releases/tag/v1.0.0
