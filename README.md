# ObservAI - Camera Analytics Platform

A modern camera analytics platform that provides real-time visitor insights, demographic analysis, and intelligent zone tracking.

## Features

### 20% Complete (Production Ready) ✅
- **Login Page (UC-01)** - Authenticate with demo credentials
- **Camera Analytics Dashboard (UC-02)** - Real-time visitor analytics with charts
- **Zone Labeling (UC-08)** - Interactive zone definition for entrance/exit tracking

### 80% Partially Implemented
- Camera Selection
- AI Insights
- Historical Analytics
- Notifications
- Settings

## Tech Stack

- **Frontend**: React + TypeScript + Vite
- **UI Library**: Tailwind CSS
- **Charts**: ECharts (echarts-for-react)
- **Icons**: Lucide React
- **Database**: Supabase
- **Routing**: React Router

## Getting Started

### Prerequisites
- Node.js 18+ 
- npm or pnpm

### Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd project
```

2. Install frontend dependencies:
```bash
cd frontend
npm install
```

3. Set up environment variables:
Create a `.env` file in the `frontend` directory:
```env
VITE_SUPABASE_URL=https://0ec90b57d6e95fcbda19832f.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJib2x0IiwicmVmIjoiMGVjOTBiNTdkNmU5NWZjYmRhMTk4MzJmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg4ODE1NzQsImV4cCI6MTc1ODg4MTU3NH0.9I8-U0x86Ak8t2DGaIk0HfvTSLsAyzdnz-Nw00mMkKw
```

4. Run the development server:
```bash
npm run dev
```

5. Open your browser and navigate to `http://localhost:5173`

### Demo Credentials

**Manager Account:**
- Email: `admin@observai.com`
- Password: `demo1234`

## Project Structure

```
frontend/
├── src/
│   ├── components/
│   │   ├── camera/           # Camera-specific components
│   │   │   ├── AgeChart.tsx
│   │   │   ├── GenderChart.tsx
│   │   │   ├── CameraFeed.tsx
│   │   │   ├── DwellTimeWidget.tsx
│   │   │   ├── VisitorCountWidget.tsx
│   │   │   └── ZoneCanvas.tsx
│   │   ├── layout/           # Layout components
│   │   └── ...
│   ├── pages/
│   │   ├── dashboard/        # Dashboard pages
│   │   │   ├── CameraAnalyticsPage.tsx
│   │   │   ├── ZoneLabelingPage.tsx
│   │   │   ├── CameraSelectionPage.tsx
│   │   │   ├── AIInsightsPage.tsx
│   │   │   └── ...
│   │   ├── HomePage.tsx
│   │   └── LoginPage.tsx
│   ├── contexts/             # React contexts
│   ├── lib/                  # Utilities (Supabase client)
│   └── App.tsx
```

## Build

```bash
npm run build
```

Build output will be in `frontend/dist/`

## Use Cases

### UC-01: Authenticate Manager
Complete authentication flow with demo account support.

### UC-02: View Operations Dashboard
Real-time analytics dashboard with:
- Live camera feed with heatmap overlay
- Gender distribution (donut chart)
- Age distribution (bar chart)
- Visitor count widget (auto-updating)
- Dwell time analysis

### UC-08: Label Entrance/Exit Zones
Interactive canvas for defining zones:
- Draw rectangular zones
- Label zones as entrance or exit
- Edit and delete zones
- Save zone configurations

## Development Notes

This project is designed for an academic increment-based development approach:
- **First 20%** is fully functional and production-ready
- **Remaining 80%** contains UI mockups and placeholders for future development

## License

MIT
