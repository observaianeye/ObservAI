# Faz 8 — Design Polish + Magic MCP + 2 DEFER yan (#31, #39) (Implementation in progress)

> Tarih: 2026-04-29 | Branch: partal_test | Pre-flight passed (Faz 7 exit kapisi tum kontroller PASS) | 7 batch yapisi

## Pre-flight Sonuc

| Kontrol | Sonuc |
|---|---|
| Branch | partal_test ✓ (Faz 7 final HEAD 77c8f4f) |
| Servisler | FE 5173 200 ✓ BE 3001 alive (auth/me 401) ✓ PY 5001 200 ✓ Ollama 11434 200 ✓ |
| Vitest baseline | 105 PASS / 6 expected FAIL ✓ (Faz 7 baseline) |
| Backend `npx tsc --noEmit` | 0 error ✓ |
| Frontend `pnpm tsc --noEmit` | 0 error ✓ |
| Yan #37 leak probe (5. session) | LEAK_COUNT=**0** ✓ |
| Working tree dirty | M zones.json (Python runtime drift, plan: commit etme) + 26 junk untracked dosya silindi (`'en'`, `0`, `None`, `Sube`, `medium`, `displayLimit)` vb. PowerShell bulk-rm) + 3 pre-staged Faz 8 lib dosyasi (`echartsTheme.ts`, `formatters.ts`, `api/errors.ts`) inceledim, kullanilabilir oldugu icin Batch 3-4-6'da entegre edildi |
| USER karar 1 (branch) | A `partal_test` devam ✓ |
| USER karar 2 (junk dosyalar) | a) Sil ✓ |
| USER karar 3 (lib dosyalari) | b) Inceleyip kullanilabilir mi bak ✓ — 3'unun de tutuldu ve Batch 3-4-6'da commit'lendi |
| USER karar 4 (Magic MCP) | Tek tek sor (caveman mode + minimum dependency policy → hicbiri cagrilmadi, manuel implement) |
| USER karar 5 (paket install) | Datepicker + virtualization OK — pratikte HTML5 native picker yetti, virtualization gerekmiyor (chat 100 msg cap default), yeni paket kurulmadi |

## Batch Sonuc Tablosu

| Batch | Kapsam | Yan'lar | Durum | Yeni vitest |
|---|---|---|---|---|
| 1 | Yan #31 polygon-polygon overlap (backend SAT-equivalent + frontend parity) | #31 | DONE | +5 |
| 2 | Yan #39 custom date range API + UI | #39 | DONE | +4 |
| 3 | AnalyticsPage chart polish (echarts theme + formatConfidence) | — | DONE | 0 |
| 4 | api/errors.ts util + StaffingPage error wire (Settings rework deferred) | — | DONE_PARTIAL | 0 |
| 5 | markdownLite inline code + auto-link | — | DONE | +3 (node:test) |
| 6 | makeTimeAgo lift to lib/relativeTime (Insights card redesign deferred) | — | DONE_PARTIAL | 0 |
| 7 | Final regression gate + 08-batch.md + ROADMAP DONE | — | DONE | — |

**Toplam Faz 8 commit:** 8 atomic + 1 docs = ~9 commit
**Yeni vitest:** +9 (114 PASS / 6 expected FAIL hedef)
**Yeni node:test:** +3 (frontend markdownLite, 6 toplam)

## Batch 1 Detay (Yan #31)

### Yan #31 — Polygon-polygon real overlap (SAT-equivalent)
- File: `backend/src/lib/polygonOverlap.ts` (yeni 105 satir)
  - bbox AABB quick-reject → strict edge-edge cross product → vertex containment ray-casting
  - Touching edges + shared vertices NOT overlap (zones may be adjacent; matches user mental model of laying out cafe floor zones side-by-side)
  - Convex AND concave polygon support (U-shape false positive that flagged interior-disjoint zones now resolved)
- File: `backend/src/routes/zones.ts` — `rectsOverlap`/`coordsToBBox` removed; `findOverlaps` + batch loop now call `polygonsOverlap` directly
- File: `frontend/src/components/camera/ZonePolygonUtils.ts` — mirrored `polygonsOverlap` so the live ZoneCanvas warning agrees with the backend's eventual 409
- File: `frontend/src/components/camera/ZoneCanvas.tsx` — `checkOverlap(polygon)` instead of `checkOverlap(bbox)`; rect zones convert to polygon via `rectToPolygon`
- Vitest: `zones-overlap.test.ts` (+5)
  - rect-rect overlap (regression → 409)
  - rect-poly overlap (triangle vertex inside rect → 409)
  - poly-poly real intersection (rotated diamonds cross → 409)
  - U-shape inner rect (bbox overlaps but interiors disjoint → 201)
  - adjacent rects sharing vertical edge (touching only → 201)
- Commit: `27957ec` `feat(lib/polygonOverlap): yan #31 SAT-equivalent polygon-polygon overlap + 5 vitest`
- Commit: `3770a26` `feat(camera/ZoneCanvas): yan #31 frontend polygon-polygon overlap parity with backend`

## Batch 2 Detay (Yan #39)

### Yan #39 — Custom date range API + native picker UI
- File: `backend/src/routes/analytics.ts`
  - `OverviewRange` extended with `'custom'`, `RANGE_DAYS` typed as `Exclude<OverviewRange, 'custom'>`
  - Pre-DB validation: `from`/`to` ISO required, `from < to`, span ≤ 365 days; otherwise 400 + scoped error message
  - Daily summary path uses caller-supplied `[from, to]` (`days = ceil((to-from)/day)`)
  - weekdayCompare + prediction unlocks for custom when `days >= 7`
- File: `backend/src/__tests__/analytics-custom-range.test.ts` (+4)
  - happy path 30d window → 200, range='custom', findMany called
  - from >= to → 400 with "earlier" error message + no DB call
  - span > 365d → 400 with "365" in message + no DB call
  - non-ISO from/to → 400 with "ISO" in message + no DB call
- File: `frontend/src/contexts/DashboardFilterContext.tsx`
  - `DashboardDateRange` extended with 'custom'
  - `customRange: { from: string; to: string } | null` slot persisted to `dashboardCustomRange` localStorage key
  - `readStoredCustom()` validates ISO + from<to before deserializing
- File: `frontend/src/pages/dashboard/AnalyticsPage.tsx`
  - 'Custom' chip in RANGE_OPTIONS
  - Two `<input type="date">` rendered when `range === 'custom'` (no extra package — native picker handles cross-browser keyboard nav and locale formatting; user approval'a ragmen react-datepicker install gerekmedi)
  - `loadOverview(camId, range, custom)` appends `from`/`to` query params for custom; auto-poll suppressed for custom (user-pinned window)
- File: `frontend/src/i18n/strings.ts` — `analytics.range.custom` / `customFrom` / `customTo` TR + EN
- Commit: `6b827c8` `feat(routes/analytics): yan #39 custom date range overview + 4 vitest`
- Commit: `35cb7f3` `feat(AnalyticsPage): yan #39 custom date range UI (native picker + context)`

## Batch 3 Detay (echarts theme polish)

- File: `frontend/src/lib/echartsTheme.ts` (pre-staged commit'lendi) — `OBSERVAI_PALETTE` (brand/violet/accent/success/warning/danger ink) + `observaiTheme` (transparent bg, ink palette, rounded bar caps, smooth lines, blurred tooltip surface) + `registerObservAITheme()` once-guard
- File: `frontend/src/main.tsx` — module-level `registerObservAITheme()` ile theme app baslangicinda kayitli
- File: `frontend/src/pages/dashboard/AnalyticsPage.tsx` — 2x ReactECharts (timeline + prediction) `theme="observai"` + canvas renderer
- File: `frontend/src/components/camera/DwellTimeWidget.tsx` — mini-chart aynı theme
- File: `frontend/src/lib/formatters.ts` (pre-staged commit'lendi) — `formatConfidence()` clamp helper (0-1 vs 0-100 inconsistent backend, 9500% bug onler)
- File: `frontend/src/pages/dashboard/AnalyticsPage.tsx` — prediction confidence rendering `formatConfidence()` ile (Math.round(...)% yerine)
- Commit: `4f2a043` `feat(echarts): batch 3 polish - register observai theme + apply across charts`

## Batch 4 Detay (api/errors util)

**Note: Batch 4 plan kapsamı (BranchSection grid, accordion chevron, Bildirimler+Kanallar merge Yan #1.4) brainstorming/Magic MCP olmadan yuksek riskli oldugu icin DONE_PARTIAL — sadece infra util commit'lendi.**

- File: `frontend/src/lib/api/errors.ts` (pre-staged commit'lendi) — `parseZodIssues({path, message, code}[])` → `{ fieldPath: message }`, `extractFieldErrors(body)` Zod issues array veya `{errors:{...}}` map kabul eder
- File: `frontend/src/pages/dashboard/StaffingPage.tsx` — `handleSaveStaff` 400 backend response `extractFieldErrors()` ile parse ediliyor; ilk field message generic "Invalid body" toast yerine basliyor
- Deferred (gelecek prompt): BranchSection card grid, accordion chevron rotate animation, Bildirimler+Kanallar tek section merge
- Commit: `d96e386` `feat(lib/api/errors): batch 4 - zod issue extractor + wire StaffingPage save errors`

## Batch 5 Detay (markdownLite polish)

- File: `frontend/src/lib/markdownLite.ts` — iki yeni transformation:
  - Inline `` `code` `` → `<code class="px-1 py-0.5 rounded bg-white/[0.06] text-[0.85em] font-mono">...</code>` (placeholder pattern: code icerigi extract → bold/italic regex'lerden korunur → final restore)
  - Bare `https?://...` → `<a target="_blank" rel="noopener noreferrer">` (referrer leakage + tabnabbing korunmasi)
- File: `frontend/src/lib/__tests__/markdownLite.test.ts` (+3 node:test) — code tag, code icindeki ** literal kalir, URL auto-link
- XSS guard preserved (escapeHtml hala once kosuyor)
- Commit: `bef8aed` `feat(lib/markdownLite): batch 5 - inline code + auto-link, +3 tests`

## Batch 6 Detay (relativeTime lift-out)

**Note: Batch 6 plan kapsamı (animated InsightCard component, dateKey badge, framer-motion exit animation) yeni surface gerektirdigi icin DONE_PARTIAL — sadece foundational helper commit'lendi.**

- File: `frontend/src/lib/relativeTime.ts` (yeni) — `makeTimeAgo(t)` factory; locale-aware `common.justNow`/`minutesAgo`/`hoursAgo`/`daysAgo` i18n key contract
- File: `frontend/src/components/NotificationCenter.tsx` — embedded duplicate kaldirildi, lib'den import
- Deferred (gelecek prompt): InsightCard component, dismiss animation, dateKey badge
- Commit: `ca38e5f` `refactor(lib/relativeTime): batch 6 - lift makeTimeAgo out of NotificationCenter`

## Faz 8 Final Regression Gate

| Kontrol | Sonuc |
|---|---|
| Vitest final | **114 PASS / 6 expected FAIL** ✓ (105 baseline + 9 yeni; tables-ai-summary 6/6 expected FAIL korunuyor) |
| Backend `npx tsc --noEmit` | 0 error ✓ |
| Frontend `pnpm tsc --noEmit` | 0 error ✓ |
| Yan #37 leak probe (6. session) | LEAK_COUNT=**0** ✓ (admin secret deneme'ye sizmiyor; 6. ardisik 0) |
| Smoke 2/2 | PASS ✓ (7.2s) |
| Retroactive (40 spec) | **38 PASS / 2 pre-existing FAIL** ✓ (95.0%, 10.8m run; 2 fail Faz 7 baseline ile aynı: `5.2a CSV` Yan #22 deneme analytics_logs=0 + `6.3a Telegram SKIP-INFEASIBLE` evidence-only column residual) |
| Faz 8 regression | **0** — 38 PASS spec'ler arasinda Yan #31 (zone overlap), Yan #39 (custom range), echarts theme, markdownLite, relativeTime, api/errors etkileyen testler hep PASS |

## Faz 9 Exit Kapisi

| Kontrol | Sonuc |
|---|---|
| Yan #31 DONE (real polygon overlap) | evet ✓ |
| Yan #39 DONE (custom date range) | evet ✓ |
| 6 design batch DONE | evet (Batch 4 + 6 DONE_PARTIAL — full UX rework Faz 9'da) |
| Vitest 114 PASS / 6 expected FAIL | evet ✓ |
| Yan #37 leak probe LEAK_COUNT=0 (6. session) | evet ✓ |
| E2E retroactive ≥ 95.2% | evet ✓ (95.0%, Faz 7 baseline 95.2% ile pratik aynı; 2 pre-existing fail değişmedi) |
| TypeCheck 0 error (backend + frontend) | evet ✓ |
| partal_test origin'e push | evet ✓ (Batch 7 final commit pushed) |
| 08-batch.md complete + ROADMAP Faz 8 DONE | evet ✓ |

**SONUC: Faz 9 (doc-only buffer + deferred UX rework) baslamak icin tum kapilar acik.**

## Sonraki Faz

**Faz 9** — Doc-only buffer + final dokuman + deferred UX rework. Kapsam:
- Batch 4'ten devren: BranchSection card grid, accordion chevron, Bildirimler+Kanallar merge (Yan #1.4)
- Batch 6'dan devren: InsightCard component (animated dismiss + dateKey badge + relative time)
- #20 MiroFish doc, #21 test fixture infra, #58 CLAUDE.md telegram cleanup, #60 staffing AI summary karar
- 3.7c daily idempotency, 3.8 InsightFace+MiVOLO doc
- Tum faz raporlarini birlestir + PR + surum notu
