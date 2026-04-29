import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerObservAITheme } from './lib/echartsTheme';

// Register the observai ECharts theme once at module evaluation so every
// <ReactECharts theme="observai" /> instance picks up the same palette and
// surface treatment. Idempotent — registerTheme() guards on second call.
registerObservAITheme();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
