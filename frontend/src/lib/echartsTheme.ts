/**
 * Centralized ECharts theme — registers once at app startup so every
 * <ReactECharts theme="observai" /> instance picks up the same look.
 *
 * Palette mirrors tailwind.config.js so charts and surrounding UI agree.
 */
import * as echarts from 'echarts';

export const OBSERVAI_PALETTE = [
  '#3988ff', // brand-400
  '#9a4dff', // violet-500
  '#12bcff', // accent-400
  '#42e7a3', // success-400
  '#ffb547', // warning-400
  '#ff6b7a', // danger-400
  '#7de6ff', // accent-200
  '#b56bff', // violet-400
];

const INK = {
  base: '#e6ebff',
  muted: '#7e89a8',
  faint: '#4a5576',
};

const SURFACE_BORDER = 'rgba(255,255,255,0.06)';

export const observaiTheme = {
  color: OBSERVAI_PALETTE,
  backgroundColor: 'transparent',
  textStyle: {
    color: INK.base,
    fontFamily: 'Inter, ui-sans-serif, system-ui',
  },
  title: {
    textStyle: { color: INK.base, fontWeight: 600 },
    subtextStyle: { color: INK.muted },
  },
  legend: {
    textStyle: { color: INK.muted },
    icon: 'roundRect',
    itemGap: 16,
  },
  grid: {
    left: '3%',
    right: '4%',
    bottom: '3%',
    top: 40,
    containLabel: true,
    borderColor: SURFACE_BORDER,
  },
  tooltip: {
    backgroundColor: 'rgba(11, 18, 38, 0.95)',
    borderColor: 'rgba(29,107,255,0.35)',
    borderWidth: 1,
    textStyle: { color: INK.base, fontSize: 12 },
    axisPointer: {
      lineStyle: { color: 'rgba(29,107,255,0.35)' },
      crossStyle: { color: 'rgba(29,107,255,0.35)' },
    },
    extraCssText: 'box-shadow: 0 12px 32px -12px rgba(0,0,0,0.7); backdrop-filter: blur(12px); border-radius: 10px; padding: 8px 12px;',
  },
  categoryAxis: {
    axisLine: { lineStyle: { color: SURFACE_BORDER } },
    axisTick: { lineStyle: { color: SURFACE_BORDER } },
    splitLine: { show: false },
    axisLabel: { color: INK.muted, fontSize: 11 },
  },
  valueAxis: {
    axisLine: { show: false },
    axisTick: { show: false },
    splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)' } },
    axisLabel: { color: INK.muted, fontSize: 11 },
  },
  line: {
    lineStyle: { width: 2 },
    symbolSize: 6,
    symbol: 'circle',
    smooth: true,
    emphasis: { lineStyle: { width: 3 } },
  },
  bar: {
    itemStyle: {
      borderRadius: [6, 6, 0, 0],
    },
  },
  pie: {
    itemStyle: {
      borderColor: 'rgba(11, 18, 38, 0.85)',
      borderWidth: 2,
    },
    label: { color: INK.base },
    labelLine: { lineStyle: { color: INK.faint } },
  },
};

let registered = false;

export function registerObservAITheme(): void {
  if (registered) return;
  echarts.registerTheme('observai', observaiTheme);
  registered = true;
}
