# ObservAI Setup Instructions

## Quick Start (Bolt.new Terminal)

If you are in Bolt.new, run these commands:

```bash
cd frontend
npm install
npm run dev
```

Then open: http://localhost:5173

## Setup on Your Local Machine

### 1. Clone the Repository

```bash
git clone https://github.com/partalemre/ObservAI.git
cd ObservAI
```

### 2. Install Dependencies

```bash
cd frontend
npm install
```

### 3. Configure Environment Variables

Create a `.env` file in the `frontend` directory:

```env
VITE_SUPABASE_URL=https://0ec90b57d6e95fcbda19832f.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJib2x0IiwicmVmIjoiMGVjOTBiNTdkNmU5NWZjYmRhMTk4MzJmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg4ODE1NzQsImV4cCI6MTc1ODg4MTU3NH0.9I8-U0x86Ak8t2DGaIk0HfvTSLsAyzdnz-Nw00mMkKw
```

### 4. Run Development Server

```bash
npm run dev
```

### 5. Open in Browser

Navigate to: http://localhost:5173

### 6. Login with Demo Account

- **Email:** admin@observai.com
- **Password:** demo1234

## Build for Production

```bash
npm run build
```

The build output will be in `frontend/dist/`

## Project Structure

```
ObservAI/
├── frontend/              # Main React application
│   ├── src/
│   │   ├── components/
│   │   │   ├── camera/   # Camera analytics components
│   │   │   ├── charts/   # Chart components (ECharts)
│   │   │   └── layout/   # Layout components
│   │   ├── pages/
│   │   │   └── dashboard/  # Dashboard pages
│   │   ├── contexts/      # React contexts (Auth)
│   │   └── lib/          # Utilities (Supabase client)
│   └── package.json
└── packages/
    └── camera-analytics/  # Python analytics package
```

## Troubleshooting

### "Missing script: dev"

Make sure you're in the `frontend` directory:
```bash
cd frontend
npm run dev
```

### Port Already in Use

If port 5173 is busy:
```bash
npm run dev -- --port 3000
```

### Dependencies Issues

Clear cache and reinstall:
```bash
rm -rf node_modules package-lock.json
npm install
```

## Features Status

### ✅ Complete (20%)
- Login Page with authentication
- Camera Analytics Dashboard with live charts
- Zone Labeling canvas

### 🚧 Partial (80%)
- Camera Selection
- AI Insights
- Historical Analytics
- Notifications
- Settings

## Tech Stack

- React 18 + TypeScript
- Vite
- Tailwind CSS
- ECharts (echarts-for-react)
- Supabase
- React Router

## Support

For issues, please create an issue on GitHub:
https://github.com/partalemre/ObservAI/issues
