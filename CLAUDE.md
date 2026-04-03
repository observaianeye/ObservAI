# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ObservAI is a real-time camera analytics platform for visitor analytics, demographics (age/gender), and smart zone tracking. Documentation and comments are primarily in Turkish.

Three services run together:
- **Frontend** (React 18 + Vite + TypeScript) — port 5173
- **Node Backend** (Express + Prisma + TypeScript) — port 3001
- **Python Analytics** (YOLO11 + InsightFace + WebSocket) — port 5001

## Development Commands

### Frontend (from `frontend/`)
```bash
pnpm install          # Install dependencies
pnpm dev              # Dev server on :5173
pnpm build            # Production build
pnpm lint             # ESLint
pnpm typecheck        # tsc --noEmit (run after every frontend edit)
```

### Backend (from `backend/`)
```bash
npm install            # Install dependencies
npm run dev            # Dev server with tsx watch on :3001
npm run build          # TypeScript compilation
npm run db:generate    # Regenerate Prisma client
npm run db:migrate     # Run pending migrations
npm run db:studio      # Open Prisma Studio GUI
npm run db:seed        # Seed the database
npm run db:reset       # Reset database (destructive)
```

### Python Analytics (from `packages/camera-analytics/`)
```bash
pip install -e ".[demographics]"    # Install with demographics support
python -m camera_analytics.run_with_websocket   # Start WebSocket server on :5001
```

### Full System
```bash
# From project root (Windows)
./start-all.bat        # Start all three services
./stop-all.bat         # Graceful shutdown

# Unix
./start-all.sh
./stop-all.sh
```

## Architecture

### Data Flow
Camera source → Python YOLO11 detection → Demographics analysis (InsightFace/MiVOLO) → Zone crossing detection → WebSocket broadcast → Frontend dashboard + Node backend persistence (SQLite dev / PostgreSQL prod)

### Frontend Key Files
- `components/camera/CameraFeed.tsx` — Main live video component (~1400 lines), handles MJPEG + WebSocket fallback
- `components/camera/ZoneCanvas.tsx` — Interactive zone drawing with normalized coordinates
- `services/cameraBackendService.ts` — WebSocket client to Python backend, health polling
- `services/analyticsDataService.ts` — Data transformation and state management
- `contexts/AuthContext.tsx` — JWT auth state; `DataModeContext.tsx` — Demo/Live toggle

### Connection State Machine
```
DISCONNECTED → CONNECTING → WAITING_FOR_BACKEND → CONNECTED → STREAMING → FAILED
```
Exponential backoff: `Math.min(30000, Math.pow(2, attempt) * 1000)`, MJPEG max 8 retries, WebSocket health poll every 3s.

### Backend Key Files
- `src/index.ts` — Express server entry point
- `src/routes/` — REST endpoints: auth, analytics, cameras, zones, ai (Gemini), export (PDF/CSV), python-backend (proxy)
- `src/middleware/roleCheck.ts` — RBAC (ADMIN, MANAGER, ANALYST, VIEWER)
- `src/services/insightEngine.ts` — AI insight generation
- `prisma/schema.prisma` — Database schema (SQLite in dev via `file:./dev.db`)

### Python Analytics Key Files
- `camera_analytics/run_with_websocket.py` — Bootstrap, event handlers (start/stop stream, zones, snapshots)
- `camera_analytics/analytics.py` — Core engine (~2100 lines): TrackedPerson, temporal smoothing (EMA + median), zone management, heatmaps, privacy blur
- `camera_analytics/config.py` — AnalyticsConfig dataclass, YAML loading, 40+ parameters
- `camera_analytics/age_gender.py` — InsightFace + MiVOLO model loading
- `camera_analytics/sources.py` — Video source handling (webcam, YouTube/yt-dlp, RTSP, files)
- `camera_analytics/optimize.py` — Hardware auto-detection (TensorRT for NVIDIA, CoreML for Apple Silicon, CPU fallback)

## Environment Setup

Copy `.env.example` files in root, `backend/`, and `frontend/`. Key variables:
- `GEMINI_API_KEY` — Required for AI Q&A features
- `DATABASE_URL` — Prisma connection (default: SQLite `file:./dev.db`)
- `VITE_BACKEND_URL=http://localhost:5001` — Python analytics URL for frontend
- `VITE_API_URL=http://localhost:3001` — Node backend URL for frontend
- `KAFKA_ENABLED=false` — Optional Kafka support (disabled by default)

## Code Conventions

- **TypeScript strict mode** — no `any` types, use proper typing
- **Python** — all async/await; do not add synchronous functions to the analytics engine
- **State management** — React Context API (no Redux/Zustand)
- **Styling** — TailwindCSS 3.4
- **Package manager** — pnpm for frontend/root, npm for backend, pip/setuptools for Python

## AI-to-AI Handoff System

This project uses an automated AI development workflow:
1. `HANDOFF.md` — Context from previous AI session (read this for ongoing task context)
2. `auto_dev_progress.json` — Task status tracking (pending/in_progress/completed/failed)
3. `ai_handoff.py` — Generates handoff documentation
4. `observai_auto_dev.py` — Scheduled automated task runner

When completing development tasks: update `auto_dev_progress.json` status and `completed_at`, then run `python ai_handoff.py` to refresh the handoff document.
