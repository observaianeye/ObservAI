/**
 * ObservAI Insight Engine
 *
 * AI-powered analytics insight generation service.
 * Generates real-time alerts, trend analysis, and AI-powered recommendations.
 * Uses Ollama (primary) with Gemini fallback for LLM-based features.
 *
 * Insight Types:
 * - occupancy_alert: Zone capacity > 80%
 * - wait_time_alert: Person in zone > threshold
 * - crowd_surge: Sudden visitor spike (>1.5x rolling average)
 * - trend: Peak hours, demographic shifts, zone comparisons
 * - recommendation: Ollama/Gemini AI-generated business suggestions
 * - demographic_trend: Morning vs evening demographic profiles
 */

import { prisma } from '../lib/db';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { callOllama } from '../routes/ai';
import { dispatchBatch } from './notificationDispatcher';
import { GEMINI_MODEL_CANDIDATES, isGeminiFallbackError } from '../lib/aiConfig';
import { fetchTrafficData } from '../routes/branches';

// ─── Weather Helper ───────────────────────────────────────────────────────────

interface WeatherData {
  temperature: number;
  weatherCode: number;
  windspeed: number;
  description: string;
}

async function getWeatherContext(lat?: number, lon?: number, city?: string): Promise<string> {
  // Try to use default branch coordinates
  if (!lat || !lon) {
    try {
      const defaultBranch = await prisma.branch.findFirst({
        where: { isDefault: true },
        select: { latitude: true, longitude: true, city: true }
      });
      if (defaultBranch) {
        lat = defaultBranch.latitude;
        lon = defaultBranch.longitude;
        city = defaultBranch.city;
      }
    } catch { /* fallback to defaults */ }
  }
  lat = lat || 39.9334;
  lon = lon || 32.8597;
  city = city || 'Ankara';
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&hourly=precipitation_probability&forecast_days=1`;
    const res = await fetch(url);
    if (!res.ok) return '';
    const data: any = await res.json();
    const cw = data.current_weather;
    // WMO Weather Code açıklamaları (kısaltılmış)
    const wmoDesc: Record<number, string> = {
      0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
      45: 'Foggy', 48: 'Icy fog', 51: 'Light drizzle', 53: 'Moderate drizzle',
      61: 'Slight rain', 63: 'Moderate rain', 65: 'Heavy rain',
      71: 'Slight snow', 73: 'Moderate snow', 75: 'Heavy snow',
      80: 'Slight showers', 81: 'Moderate showers', 82: 'Violent showers',
      95: 'Thunderstorm', 99: 'Thunderstorm with hail',
    };
    const desc = wmoDesc[cw.weathercode] || `Code ${cw.weathercode}`;
    // Precipitation probability (next hour)
    const precipProb = data.hourly?.precipitation_probability?.[new Date().getHours()] ?? null;
    let weatherStr = `Current Weather (${city}): ${cw.temperature}°C, ${desc}, Wind: ${cw.windspeed} km/h`;
    if (precipProb !== null) weatherStr += `, Rain probability: ${precipProb}%`;
    return weatherStr;
  } catch {
    return '';
  }
}

// ─── Traffic Helper ───────────────────────────────────────────────────────────

async function getTrafficContext(lat?: number, lon?: number, timezone?: string, city?: string): Promise<string> {
  if (!lat || !lon || !timezone) {
    try {
      const defaultBranch = await prisma.branch.findFirst({
        where: { isDefault: true },
        select: { latitude: true, longitude: true, timezone: true, city: true }
      });
      if (defaultBranch) {
        lat = defaultBranch.latitude;
        lon = defaultBranch.longitude;
        timezone = defaultBranch.timezone;
        city = city || defaultBranch.city;
      }
    } catch { /* ignore */ }
  }
  lat = lat || 39.9334;
  lon = lon || 32.8597;
  timezone = timezone || 'Europe/Istanbul';
  city = city || 'Ankara';
  try {
    const t = await fetchTrafficData(lat, lon, timezone);
    const pct = Math.round(t.congestion * 100);
    const speed = t.currentSpeed && t.freeFlowSpeed
      ? `, ${t.currentSpeed}/${t.freeFlowSpeed} km/h`
      : '';
    return `Traffic (${city}, hour ${t.localHour}): ${t.level} congestion (${pct}%${speed}, source: ${t.source})`;
  } catch {
    return '';
  }
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface InsightResult {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  cameraId: string;
  zoneId?: string;
  context?: Record<string, any>;
}

export interface TrendAnalysis {
  peakHours: { hour: number; avgOccupancy: number }[];
  quietHours: { hour: number; avgOccupancy: number }[];
  totalVisitors: number;
  avgOccupancy: number;
  demographicProfile: {
    dominantGender: string;
    dominantAgeGroup: string;
    genderDistribution: Record<string, number>;
    ageDistribution: Record<string, number>;
  } | null;
  zoneComparison: { zoneId: string; zoneName: string; alertCount: number }[];
  periodLabel: string;
}

export interface StatsResult {
  period: string;
  cameraId: string;
  totalVisitors: number;
  avgOccupancy: number;
  peakOccupancy: number;
  peakHour: string;
  totalAlerts: number;
  alertsBySeverity: Record<string, number>;
  demographics: {
    genderDistribution: Record<string, number>;
    ageDistribution: Record<string, number>;
  } | null;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const CROWD_SURGE_MULTIPLIER = 1.5;
const OCCUPANCY_ALERT_THRESHOLD = 0.8; // 80% capacity
const DEFAULT_ZONE_CAPACITY = 50;
const TREND_MIN_DATA_POINTS = 5;

// ─── Insight Engine ──────────────────────────────────────────────────────────

/**
 * Check real-time analytics data and generate alerts.
 * Called periodically or on-demand when new analytics data arrives.
 */
export async function checkRealtimeAlerts(cameraId: string): Promise<InsightResult[]> {
  const insights: InsightResult[] = [];

  try {
    // Get last 60 minutes of data
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);

    const [recentLogs, last5MinLogs] = await Promise.all([
      prisma.analyticsLog.findMany({
        where: { cameraId, timestamp: { gte: oneHourAgo } },
        orderBy: { timestamp: 'desc' },
      }),
      prisma.analyticsLog.findMany({
        where: { cameraId, timestamp: { gte: fiveMinAgo } },
        orderBy: { timestamp: 'desc' },
      }),
    ]);

    if (recentLogs.length < TREND_MIN_DATA_POINTS) {
      return insights; // Not enough data
    }

    // ── Crowd Surge Detection ──
    const avgEntriesLastHour = recentLogs.reduce((s, l) => s + l.peopleIn, 0) / recentLogs.length;
    const avgEntriesLast5Min = last5MinLogs.length > 0
      ? last5MinLogs.reduce((s, l) => s + l.peopleIn, 0) / last5MinLogs.length
      : 0;

    if (avgEntriesLastHour > 0 && avgEntriesLast5Min > avgEntriesLastHour * CROWD_SURGE_MULTIPLIER) {
      const surgeRatio = (avgEntriesLast5Min / avgEntriesLastHour).toFixed(1);
      insights.push({
        type: 'crowd_surge',
        severity: avgEntriesLast5Min > avgEntriesLastHour * 2 ? 'critical' : 'high',
        title: 'Crowd Surge Detected',
        message: `Visitor entry rate in the last 5 minutes is ${surgeRatio}x the hourly average. ` +
          `Current rate: ${avgEntriesLast5Min.toFixed(1)}/snapshot vs average ${avgEntriesLastHour.toFixed(1)}/snapshot.`,
        cameraId,
        context: {
          avgEntriesLastHour: round2(avgEntriesLastHour),
          avgEntriesLast5Min: round2(avgEntriesLast5Min),
          surgeRatio: parseFloat(surgeRatio),
        },
      });
    }

    // ── High Occupancy Alert ──
    const latestLog = recentLogs[0];
    if (latestLog && latestLog.currentCount > DEFAULT_ZONE_CAPACITY * OCCUPANCY_ALERT_THRESHOLD) {
      const occupancyPct = Math.round((latestLog.currentCount / DEFAULT_ZONE_CAPACITY) * 100);
      insights.push({
        type: 'occupancy_alert',
        severity: occupancyPct >= 100 ? 'critical' : 'high',
        title: 'High Occupancy Alert',
        message: `Current occupancy is at ${occupancyPct}% capacity (${latestLog.currentCount}/${DEFAULT_ZONE_CAPACITY}). ` +
          `Consider managing crowd flow.`,
        cameraId,
        context: {
          currentCount: latestLog.currentCount,
          capacity: DEFAULT_ZONE_CAPACITY,
          occupancyPct,
        },
      });
    }

    // ── Wait Time Alert ──
    if (latestLog && latestLog.avgWaitTime && latestLog.avgWaitTime > 300) {
      const waitMinutes = Math.round(latestLog.avgWaitTime / 60);
      insights.push({
        type: 'wait_time_alert',
        severity: waitMinutes > 10 ? 'high' : 'medium',
        title: 'Long Wait Time Detected',
        message: `Average wait time has reached ${waitMinutes} minutes. ` +
          `Queue count: ${latestLog.queueCount || 'N/A'}.`,
        cameraId,
        context: {
          avgWaitTime: latestLog.avgWaitTime,
          waitMinutes,
          queueCount: latestLog.queueCount,
        },
      });
    }
  } catch (error) {
    console.error('[InsightEngine] Error checking real-time alerts:', error);
  }

  return insights;
}

/**
 * Analyze trends over a given time period.
 */
export async function analyzeTrends(
  cameraId: string,
  startDate: Date,
  endDate: Date
): Promise<TrendAnalysis> {
  const logs = await prisma.analyticsLog.findMany({
    where: {
      cameraId,
      timestamp: { gte: startDate, lte: endDate },
    },
    orderBy: { timestamp: 'asc' },
  });

  // ── Peak / Quiet Hours ──
  const hourlyOccupancy: Record<number, { total: number; count: number }> = {};
  for (let h = 0; h < 24; h++) {
    hourlyOccupancy[h] = { total: 0, count: 0 };
  }
  logs.forEach(log => {
    const hour = new Date(log.timestamp).getHours();
    hourlyOccupancy[hour].total += log.currentCount;
    hourlyOccupancy[hour].count += 1;
  });

  const hourlyAvg = Object.entries(hourlyOccupancy)
    .filter(([, v]) => v.count > 0)
    .map(([hour, v]) => ({
      hour: parseInt(hour),
      avgOccupancy: round2(v.total / v.count),
    }))
    .sort((a, b) => b.avgOccupancy - a.avgOccupancy);

  const peakHours = hourlyAvg.slice(0, 3);
  const quietHours = hourlyAvg.slice(-3).reverse();

  // ── Demographics ──
  const demographicProfile = extractDemographicProfile(logs);

  // ── Zone Comparison ──
  let zoneComparison: { zoneId: string; zoneName: string; alertCount: number }[] = [];
  try {
    const zoneInsights = await prisma.zoneInsight.groupBy({
      by: ['zoneId'],
      _count: { id: true },
      where: {
        timestamp: { gte: startDate, lte: endDate },
      },
      orderBy: { _count: { id: 'desc' } },
    });

    if (zoneInsights.length > 0) {
      const zoneIds = zoneInsights.map(z => z.zoneId);
      const zones = await prisma.zone.findMany({
        where: { id: { in: zoneIds } },
        select: { id: true, name: true },
      });
      const zoneMap = new Map(zones.map(z => [z.id, z.name]));

      zoneComparison = zoneInsights.map(z => ({
        zoneId: z.zoneId,
        zoneName: zoneMap.get(z.zoneId) || z.zoneId,
        alertCount: z._count.id,
      }));
    }
  } catch {
    // Zone comparison is optional
  }

  // ── Summary ──
  const totalVisitors = logs.length > 0
    ? logs[logs.length - 1].peopleIn // Cumulative
    : 0;
  const avgOccupancy = logs.length > 0
    ? round2(logs.reduce((s, l) => s + l.currentCount, 0) / logs.length)
    : 0;

  const diffDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  const periodLabel = diffDays <= 1 ? 'Today' : diffDays <= 7 ? 'This Week' : 'This Month';

  return {
    peakHours,
    quietHours,
    totalVisitors,
    avgOccupancy,
    demographicProfile,
    zoneComparison,
    periodLabel,
  };
}

/**
 * Get aggregated statistics for a camera over a period.
 */
export async function getStats(
  cameraId: string,
  period: 'day' | 'week' | 'month' = 'day'
): Promise<StatsResult> {
  const now = new Date();
  const startDate = new Date(now);

  switch (period) {
    case 'day':
      startDate.setHours(0, 0, 0, 0);
      break;
    case 'week':
      startDate.setDate(now.getDate() - 7);
      break;
    case 'month':
      startDate.setMonth(now.getMonth() - 1);
      break;
  }

  const [logs, alertCountResult, alertsBySeverityResult, summaries] = await Promise.all([
    prisma.analyticsLog.findMany({
      where: { cameraId, timestamp: { gte: startDate } },
      orderBy: { timestamp: 'desc' },
    }),
    prisma.$queryRaw<{ cnt: number }[]>`
      SELECT COUNT(*) as cnt FROM insights WHERE "cameraId" = ${cameraId} AND "createdAt" >= ${startDate.toISOString()}
    `,
    prisma.$queryRaw<{ severity: string; cnt: number }[]>`
      SELECT severity, COUNT(*) as cnt FROM insights WHERE "cameraId" = ${cameraId} AND "createdAt" >= ${startDate.toISOString()} GROUP BY severity
    `,
    // Fallback: AnalyticsSummary (hourly rows) when AnalyticsLog is empty — the
    // backfill script populates Summary but not Log, so dev databases end up
    // with rich historical summaries and no stream logs.
    prisma.analyticsSummary.findMany({
      where: { cameraId, date: { gte: startDate }, hour: { not: null } },
      orderBy: { date: 'desc' },
    }),
  ]);
  const alertCount = Number(alertCountResult[0]?.cnt || 0);
  const alertsBySeverity = alertsBySeverityResult;

  const hasLogs = logs.length > 0;

  const totalVisitors = hasLogs
    ? logs.reduce((s, l) => s + l.peopleIn, 0)
    : summaries.reduce((s, row) => s + row.totalEntries, 0);
  const avgOccupancy = hasLogs
    ? (logs.length > 0 ? round2(logs.reduce((s, l) => s + l.currentCount, 0) / logs.length) : 0)
    : (summaries.length > 0 ? round2(summaries.reduce((s, row) => s + row.avgOccupancy, 0) / summaries.length) : 0);
  const peakOccupancy = hasLogs
    ? (logs.length > 0 ? Math.max(...logs.map(l => l.currentCount)) : 0)
    : (summaries.length > 0 ? Math.max(...summaries.map((r) => r.peakOccupancy)) : 0);

  // Peak hour
  let peakHour = 'N/A';
  if (hasLogs) {
    const hourCounts: Record<number, number> = {};
    logs.forEach((l) => {
      const h = new Date(l.timestamp).getHours();
      hourCounts[h] = (hourCounts[h] || 0) + l.currentCount;
    });
    const peakEntry = Object.entries(hourCounts).sort(([, a], [, b]) => b - a)[0];
    if (peakEntry) peakHour = `${peakEntry[0]}:00`;
  } else if (summaries.length > 0) {
    const hourCounts: Record<number, number> = {};
    summaries.forEach((row) => {
      if (row.hour === null || row.hour === undefined) return;
      hourCounts[row.hour] = (hourCounts[row.hour] || 0) + row.totalEntries;
    });
    const peakEntry = Object.entries(hourCounts).sort(([, a], [, b]) => b - a)[0];
    if (peakEntry) peakHour = `${peakEntry[0]}:00`;
  }

  const severityMap: Record<string, number> = {};
  alertsBySeverity.forEach(a => {
    severityMap[a.severity] = Number(a.cnt);
  });

  let demographics: ReturnType<typeof extractDemographicProfile> | null = null;
  if (hasLogs) {
    demographics = extractDemographicProfile(logs);
  } else if (summaries.length > 0) {
    // Merge demographics across summary rows (already aggregated JSON per hour)
    const genderMerged: Record<string, number> = {};
    const ageMerged: Record<string, number> = {};
    for (const row of summaries) {
      if (!row.demographics) continue;
      try {
        const d = JSON.parse(row.demographics);
        if (d.gender) for (const [k, v] of Object.entries(d.gender)) {
          if (typeof v === 'number') genderMerged[k] = (genderMerged[k] ?? 0) + v;
        }
        if (d.age) for (const [k, v] of Object.entries(d.age)) {
          if (typeof v === 'number') ageMerged[k] = (ageMerged[k] ?? 0) + v;
        }
      } catch { /* skip */ }
    }
    const genderTotal = Object.values(genderMerged).reduce((a, b) => a + b, 0);
    const ageTotal = Object.values(ageMerged).reduce((a, b) => a + b, 0);
    if (genderTotal > 0 || ageTotal > 0) {
      const dominantGender = Object.entries(genderMerged).sort(([, a], [, b]) => b - a)[0]?.[0] || 'unknown';
      const dominantAgeGroup = Object.entries(ageMerged).sort(([, a], [, b]) => b - a)[0]?.[0] || 'unknown';
      demographics = {
        dominantGender,
        dominantAgeGroup,
        genderDistribution: genderMerged,
        ageDistribution: ageMerged,
      };
    }
  }

  return {
    period,
    cameraId,
    totalVisitors,
    avgOccupancy,
    peakOccupancy,
    peakHour,
    totalAlerts: alertCount,
    alertsBySeverity: severityMap,
    demographics: demographics
      ? {
          genderDistribution: demographics.genderDistribution,
          ageDistribution: demographics.ageDistribution,
        }
      : null,
  };
}

/**
 * Build the analytics context string for recommendation generation.
 */
async function buildRecommendationContext(cameraId?: string): Promise<{
  contextStr: string;
  totalVisitors: number;
  avgOccupancy: number;
  demographics: ReturnType<typeof extractDemographicProfile>;
}> {
  const oneDay = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const where: any = { timestamp: { gte: oneDay } };
  if (cameraId) where.cameraId = cameraId;

  const [logs, zoneInsights, recentInsights] = await Promise.all([
    prisma.analyticsLog.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: 200,
    }),
    prisma.zoneInsight.findMany({
      where: { timestamp: { gte: oneDay } },
      orderBy: { timestamp: 'desc' },
      take: 50,
      include: { zone: { select: { name: true, type: true } } },
    }),
    prisma.$queryRaw<any[]>`
      SELECT * FROM insights WHERE "createdAt" >= ${oneDay.toISOString()} ORDER BY "createdAt" DESC LIMIT 20
    `,
  ]);

  const totalVisitors = logs.reduce((s, l) => s + l.peopleIn, 0);
  const avgOccupancy = logs.length > 0
    ? round2(logs.reduce((s, l) => s + l.currentCount, 0) / logs.length)
    : 0;
  const peakCount = logs.length > 0 ? Math.max(...logs.map(l => l.currentCount)) : 0;
  const demographics = extractDemographicProfile(logs);

  const zoneSummary = zoneInsights.slice(0, 10).map(zi =>
    `- ${zi.zone?.name || 'Unknown zone'}: Person stayed ${Math.round(zi.duration / 60)} min` +
    (zi.gender ? ` (${zi.gender}` + (zi.age ? `, age ~${zi.age}` : '') + ')' : '')
  ).join('\n');

  const alertSummary = recentInsights.slice(0, 5).map(i =>
    `- [${i.severity.toUpperCase()}] ${i.title}: ${i.message}`
  ).join('\n');

  const weatherCtx = await getWeatherContext();
  const trafficCtx = await getTrafficContext();

  const contextStr = `
=== LAST 24-HOUR ANALYTICS SUMMARY ===
Total Visitors: ${totalVisitors}
Average Occupancy: ${avgOccupancy}
Peak Occupancy: ${peakCount}
Data Points: ${logs.length}

${weatherCtx ? `Weather Context:\n  ${weatherCtx}` : ''}
${trafficCtx ? `Traffic Context:\n  ${trafficCtx}` : ''}

${demographics ? `Demographics:
  Dominant Gender: ${demographics.dominantGender}
  Dominant Age Group: ${demographics.dominantAgeGroup}
  Gender: ${JSON.stringify(demographics.genderDistribution)}
  Ages: ${JSON.stringify(demographics.ageDistribution)}` : 'Demographics: Not available'}

${zoneSummary ? `Zone Alerts:\n${zoneSummary}` : 'Zone Alerts: None'}

${alertSummary ? `Recent Alerts:\n${alertSummary}` : 'Recent Alerts: None'}
`;

  return { contextStr, totalVisitors, avgOccupancy, demographics };
}

/**
 * Parse AI response text into an array of recommendation strings.
 */
function parseRecommendations(text: string): string[] {
  // Try JSON array first
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed)) return parsed.map(String).slice(0, 5);
    } catch { /* fall through */ }
  }
  // Fallback: split by newlines and filter meaningful lines
  return text
    .split('\n')
    .map(l => l.replace(/^\d+[\.\)]\s*/, '').trim()) // Remove numbered prefixes
    .filter(l => l.length > 15)
    .slice(0, 5);
}

/**
 * Generate AI-powered recommendations.
 * Priority: Ollama (primary) -> Gemini (fallback) -> Demo recommendations
 */
export async function getAIRecommendations(cameraId?: string): Promise<string[]> {
  try {
    const { contextStr, totalVisitors, avgOccupancy, demographics } =
      await buildRecommendationContext(cameraId);

    const prompt = `You are an AI analytics advisor for ObservAI, a real-time visitor analytics platform for cafes and restaurants.

Based on the following analytics data, provide exactly 5 actionable business recommendations.
Each recommendation should be specific, data-driven, and implementable.

LANGUAGE RULE:
- Write recommendations in BOTH Turkish and English format.
- Format each recommendation as: "TR: <Turkish> | EN: <English>"

${contextStr}

Format: Return ONLY a JSON array of 5 strings, each a concise recommendation (1-2 sentences).
Example: ["TR: Yogun saatlerde 2 ek personel ayin. | EN: Assign 2 additional staff during peak hours.", ...]

Recommendations:`;

    const AI_PROVIDER = process.env.AI_PROVIDER || 'ollama';

    // --- Try Ollama first (primary provider) ---
    if (AI_PROVIDER === 'ollama') {
      try {
        const { response: aiResponse, model } = await callOllama(prompt);
        console.log(`[InsightEngine] Ollama recommendation generated via ${model}`);
        const recs = parseRecommendations(aiResponse);
        if (recs.length > 0) return recs;
      } catch (ollamaErr: unknown) {
        const errMsg = ollamaErr instanceof Error ? ollamaErr.message : '';
        console.warn(`[InsightEngine] Ollama failed for recommendations: ${errMsg}`);
        // Fall through to Gemini
      }
    }

    // --- Try Gemini fallback ---
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
    if (GEMINI_API_KEY) {
      const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
      for (const modelName of GEMINI_MODEL_CANDIDATES) {
        try {
          const model = genAI.getGenerativeModel({ model: modelName });
          const result = await model.generateContent(prompt);
          const text = result.response.text();
          console.log(`[InsightEngine] Gemini recommendation via ${modelName}`);
          const recs = parseRecommendations(text);
          if (recs.length > 0) return recs;
        } catch (err: unknown) {
          if (isGeminiFallbackError(err)) {
            console.log(`[InsightEngine] Gemini ${modelName}: quota/404, trying next`);
          } else {
            console.error(`[InsightEngine] Gemini ${modelName}: error - ${err instanceof Error ? err.message : String(err)}`);
            break;
          }
        }
      }
    }

    // --- Fallback to demo recommendations ---
    console.log('[InsightEngine] All AI providers unavailable, returning demo recommendations');
    return getDemoRecommendations(totalVisitors, avgOccupancy, demographics);
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('[InsightEngine] Error generating recommendations:', errMsg);
    return getDemoRecommendations();
  }
}

/**
 * Build a cross-period analytics context (current 24h vs previous 7d baseline).
 * Used to ground the AI summary so the model isn't hallucinating numbers.
 */
async function buildSummaryContext(cameraId?: string): Promise<{
  contextStr: string;
  hasData: boolean;
  totalVisitors: number;
  prevWeekTotal: number;
  weather: string;
  traffic: string;
}> {
  const now = new Date();
  const oneDay = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const sevenDays = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const fourteenDays = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  const where24h: any = { timestamp: { gte: oneDay } };
  const where7d: any = { timestamp: { gte: sevenDays, lt: oneDay } };
  const wherePrevWeek: any = { timestamp: { gte: fourteenDays, lt: sevenDays } };
  if (cameraId) {
    where24h.cameraId = cameraId;
    where7d.cameraId = cameraId;
    wherePrevWeek.cameraId = cameraId;
  }

  const [logs24h, logs7d, logsPrev, recentInsights, branch] = await Promise.all([
    prisma.analyticsLog.findMany({ where: where24h, orderBy: { timestamp: 'desc' }, take: 500 }),
    prisma.analyticsLog.findMany({ where: where7d, orderBy: { timestamp: 'desc' }, take: 1500 }),
    prisma.analyticsLog.findMany({ where: wherePrevWeek, orderBy: { timestamp: 'desc' }, take: 1500 }),
    prisma.$queryRaw<any[]>`
      SELECT severity, title, message, "createdAt" FROM insights
      WHERE "createdAt" >= ${sevenDays.toISOString()}
      ORDER BY "createdAt" DESC LIMIT 25
    `,
    prisma.branch.findFirst({ where: { isDefault: true }, select: { latitude: true, longitude: true, timezone: true, city: true } }),
  ]);

  const sumIn = (xs: any[]) => xs.reduce((s, l) => s + l.peopleIn, 0);
  const avgOcc = (xs: any[]) =>
    xs.length > 0 ? round2(xs.reduce((s, l) => s + l.currentCount, 0) / xs.length) : 0;
  const peak = (xs: any[]) => (xs.length > 0 ? Math.max(...xs.map((l) => l.currentCount)) : 0);

  const hasData = logs24h.length > 0 || logs7d.length > 0;
  const visitors24h = sumIn(logs24h);
  const visitors7d = sumIn(logs7d);
  const visitorsPrev = sumIn(logsPrev);
  const wow = visitorsPrev > 0 ? Math.round(((visitors7d - visitorsPrev) / visitorsPrev) * 100) : null;

  const demo24h = extractDemographicProfile(logs24h);
  const demo7d = extractDemographicProfile(logs7d);

  const insightsLine = recentInsights.length === 0
    ? 'No alerts in the last 7 days'
    : recentInsights.slice(0, 5).map((i) => `[${i.severity}] ${i.title}`).join('; ');

  const weather = branch
    ? await getWeatherContext(branch.latitude, branch.longitude, branch.city)
    : await getWeatherContext();
  const traffic = branch
    ? await getTrafficContext(branch.latitude, branch.longitude, branch.timezone, branch.city)
    : await getTrafficContext();

  const contextStr = `
=== LAST 24 HOURS ===
Visitors: ${visitors24h}
Avg occupancy: ${avgOcc(logs24h)}
Peak: ${peak(logs24h)}
Demographics: ${demo24h ? `${demo24h.dominantGender} dominant, age group ${demo24h.dominantAgeGroup}` : 'n/a'}

=== PREVIOUS 7 DAYS ===
Visitors: ${visitors7d}
Avg occupancy: ${avgOcc(logs7d)}
Peak: ${peak(logs7d)}
Demographics: ${demo7d ? `${demo7d.dominantGender} dominant, age group ${demo7d.dominantAgeGroup}` : 'n/a'}

=== WEEK-OVER-WEEK ===
This week: ${visitors7d} visitors
Prior week: ${visitorsPrev} visitors
Change: ${wow === null ? 'no prior baseline' : `${wow > 0 ? '+' : ''}${wow}%`}

=== WEATHER ===
${weather || 'Weather: not available'}

=== TRAFFIC ===
${traffic || 'Traffic: not available'}
Note: Traffic congestion can shift customer arrival patterns. Compare visitor counts during high-traffic windows vs free-flow windows.

=== RECENT ALERTS ===
${insightsLine}
`;

  return { contextStr, hasData, totalVisitors: visitors24h, prevWeekTotal: visitorsPrev, weather, traffic };
}

function buildDemoSummary(
  ctx: { totalVisitors: number; prevWeekTotal: number; weather: string; traffic: string }
): { tr: string; en: string } {
  const wow = ctx.prevWeekTotal > 0
    ? Math.round(((ctx.totalVisitors - ctx.prevWeekTotal) / ctx.prevWeekTotal) * 100)
    : null;
  const wowStr = wow === null ? 'henüz haftalık karşılaştırma yapılamadı' : `${wow > 0 ? '+' : ''}${wow}%`;
  const wowStrEn = wow === null ? 'no prior week baseline' : `${wow > 0 ? '+' : ''}${wow}%`;
  const w = ctx.weather || 'hava durumu verisi alınamadı';
  const tr = ctx.traffic || 'trafik verisi alınamadı';
  return {
    tr: `Son 24 saatte ${ctx.totalVisitors} ziyaretçi kayıt edildi (haftalık değişim ${wowStr}). Hava: ${w}. Trafik: ${tr}.`,
    en: `Last 24 hours recorded ${ctx.totalVisitors} visitors (week-over-week ${wowStrEn}). Weather: ${w}. Traffic: ${tr}.`,
  };
}

/**
 * Generate a short, grounded AI summary covering recent traffic, demographic
 * shift vs the prior week, weather context, and any open alerts.
 *
 * Returns paired Turkish + English paragraphs so the frontend can render the
 * one matching the active locale without a second round-trip.
 */
export async function getAISummary(cameraId?: string): Promise<{
  tr: string;
  en: string;
  source: 'ollama' | 'gemini' | 'demo';
}> {
  try {
    const ctx = await buildSummaryContext(cameraId);
    if (!ctx.hasData) {
      const demo = buildDemoSummary(ctx);
      return { ...demo, source: 'demo' };
    }

    const prompt = `You are an AI analytics advisor for ObservAI, a real-time visitor analytics platform for cafes/restaurants.

Write ONE concise summary (3-5 sentences) describing the current operational picture.
Mention:
- Recent visitor traffic vs the previous week
- Weather and how it might be influencing footfall
- The dominant demographic shift, if any
- Any standout alerts

CRITICAL RULES:
- Only state facts present in the context below. Do NOT invent numbers.
- If a value is missing, omit it rather than guessing.
- Output BOTH a Turkish and English version.

${ctx.contextStr}

Return ONLY a JSON object with this exact shape (no extra text, no code fences):
{"tr":"<Turkish summary>","en":"<English summary>"}`;

    const parseJSON = (text: string): { tr: string; en: string } | null => {
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) return null;
      try {
        const parsed = JSON.parse(match[0]);
        if (typeof parsed?.tr === 'string' && typeof parsed?.en === 'string') {
          return { tr: parsed.tr.trim(), en: parsed.en.trim() };
        }
      } catch { /* fall through */ }
      return null;
    };

    const AI_PROVIDER = process.env.AI_PROVIDER || 'ollama';
    if (AI_PROVIDER === 'ollama') {
      try {
        const { response, model } = await callOllama(prompt);
        console.log(`[InsightEngine] AI summary via Ollama ${model}`);
        const parsed = parseJSON(response);
        if (parsed) return { ...parsed, source: 'ollama' };
      } catch (err) {
        const m = err instanceof Error ? err.message : String(err);
        console.warn(`[InsightEngine] Ollama summary failed: ${m}`);
      }
    }

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
    if (GEMINI_API_KEY) {
      const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
      for (const modelName of GEMINI_MODEL_CANDIDATES) {
        try {
          const model = genAI.getGenerativeModel({ model: modelName });
          const result = await model.generateContent(prompt);
          const text = result.response.text();
          console.log(`[InsightEngine] AI summary via Gemini ${modelName}`);
          const parsed = parseJSON(text);
          if (parsed) return { ...parsed, source: 'gemini' };
        } catch (err) {
          if (isGeminiFallbackError(err)) {
            console.log(`[InsightEngine] Gemini ${modelName} summary: quota/404, trying next`);
          } else {
            console.error(`[InsightEngine] Gemini ${modelName} summary error: ${err instanceof Error ? err.message : String(err)}`);
            break;
          }
        }
      }
    }

    const demo = buildDemoSummary(ctx);
    return { ...demo, source: 'demo' };
  } catch (err) {
    const m = err instanceof Error ? err.message : String(err);
    console.error('[InsightEngine] AI summary error:', m);
    return {
      tr: 'AI özeti şu anda üretilemiyor. Daha sonra tekrar deneyin.',
      en: 'AI summary unavailable right now. Please try again later.',
      source: 'demo',
    };
  }
}

/**
 * Save generated insights to the database.
 * Uses raw SQL to work without regenerated Prisma client.
 */
export async function saveInsights(insights: InsightResult[]): Promise<number> {
  if (insights.length === 0) return 0;

  let saved = 0;
  for (const i of insights) {
    const id = crypto.randomUUID();
    const context = i.context ? JSON.stringify(i.context) : null;
    await prisma.$executeRaw`
      INSERT INTO insights (id, "cameraId", "zoneId", type, severity, title, message, context, "isRead", "createdAt")
      VALUES (${id}, ${i.cameraId}, ${i.zoneId || null}, ${i.type}, ${i.severity}, ${i.title}, ${i.message}, ${context}, false, ${new Date().toISOString()})
    `;
    saved++;
  }

  return saved;
}

/**
 * Generate insights for a camera and persist them.
 * This is the main entry point for on-demand insight generation.
 */
export async function generateInsights(cameraId: string): Promise<{
  alerts: InsightResult[];
  trends: TrendAnalysis;
  saved: number;
}> {
  // Generate real-time alerts
  const alerts = await checkRealtimeAlerts(cameraId);

  // Generate trend insights
  const now = new Date();
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const trends = await analyzeTrends(cameraId, dayStart, now);

  // Generate trend-based insights
  if (trends.peakHours.length > 0) {
    const peakHour = trends.peakHours[0];
    const currentHour = now.getHours();
    // Alert if approaching peak hour (1 hour before)
    if (currentHour === peakHour.hour - 1) {
      alerts.push({
        type: 'trend',
        severity: 'medium',
        title: 'Peak Hour Approaching',
        message: `Peak hour (${peakHour.hour}:00) is approaching with average occupancy of ${peakHour.avgOccupancy}. ` +
          `Consider preparing additional staff.`,
        cameraId,
        context: { peakHour: peakHour.hour, avgOccupancy: peakHour.avgOccupancy },
      });
    }
  }

  // Demographic trend insight
  if (trends.demographicProfile) {
    const dp = trends.demographicProfile;
    alerts.push({
      type: 'demographic_trend',
      severity: 'low',
      title: 'Demographic Profile Update',
      message: `Today's dominant visitor profile: ${dp.dominantGender}, ${dp.dominantAgeGroup}. ` +
        `Gender split: ${JSON.stringify(dp.genderDistribution)}.`,
      cameraId,
      context: { ...dp },
    });
  }

  // Save all alerts to DB
  const saved = await saveInsights(alerts);

  // Dispatch notifications (Telegram + Email) for high/critical alerts
  try {
    // Resolve camera name for notification messages
    let cameraName: string | undefined;
    try {
      const cam = await prisma.camera.findUnique({ where: { id: cameraId }, select: { name: true } });
      cameraName = cam?.name || undefined;
    } catch { /* camera lookup optional */ }

    const dispatchable = alerts
      .filter(a => a.severity === 'high' || a.severity === 'critical' || a.severity === 'medium')
      .map(a => ({ ...a, cameraName }));

    if (dispatchable.length > 0) {
      await dispatchBatch(dispatchable);
    }
  } catch (dispatchErr) {
    console.error('[InsightEngine] Notification dispatch error:', dispatchErr instanceof Error ? dispatchErr.message : dispatchErr);
  }

  return { alerts, trends, saved };
}

// ─── Helper Functions ────────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function extractDemographicProfile(logs: any[]): TrendAnalysis['demographicProfile'] {
  const genderCounts: Record<string, number> = {};
  const ageCounts: Record<string, number> = {};

  logs.forEach(log => {
    if (!log.demographics) return;
    let demo: any;
    try {
      demo = typeof log.demographics === 'string' ? JSON.parse(log.demographics) : log.demographics;
    } catch {
      return;
    }

    if (demo.gender) {
      Object.entries(demo.gender).forEach(([g, c]) => {
        genderCounts[g] = (genderCounts[g] || 0) + (c as number);
      });
    }
    if (demo.age) {
      Object.entries(demo.age).forEach(([a, c]) => {
        ageCounts[a] = (ageCounts[a] || 0) + (c as number);
      });
    }
  });

  if (Object.keys(genderCounts).length === 0 && Object.keys(ageCounts).length === 0) {
    return null;
  }

  const dominantGender = Object.entries(genderCounts).sort(([, a], [, b]) => b - a)[0]?.[0] || 'unknown';
  const dominantAgeGroup = Object.entries(ageCounts).sort(([, a], [, b]) => b - a)[0]?.[0] || 'unknown';

  return {
    dominantGender,
    dominantAgeGroup,
    genderDistribution: genderCounts,
    ageDistribution: ageCounts,
  };
}

function getDemoRecommendations(
  totalVisitors?: number,
  avgOccupancy?: number,
  demographics?: any
): string[] {
  const recs: string[] = [];

  if (totalVisitors && totalVisitors > 100) {
    recs.push(`With ${totalVisitors} visitors today, consider extending peak-hour staffing to maintain service quality.`);
  } else {
    recs.push('Monitor visitor trends over the next few days to establish baseline traffic patterns for better staffing decisions.');
  }

  if (avgOccupancy && avgOccupancy > 30) {
    recs.push(`Average occupancy of ${avgOccupancy} suggests high demand. Consider optimizing queue layout to reduce wait times.`);
  } else {
    recs.push('Current occupancy levels are moderate. This may be a good time to run promotional events to increase foot traffic.');
  }

  if (demographics?.dominantAgeGroup) {
    recs.push(`Your dominant visitor demographic is ${demographics.dominantAgeGroup}. Tailor in-store promotions and product placement accordingly.`);
  } else {
    recs.push('Enable demographic tracking to get personalized recommendations about your visitor base.');
  }

  recs.push('Review zone-level heatmaps weekly to identify underutilized areas and optimize store layout.');
  recs.push('Set up automated alerts for crowd surge events to proactively manage peak traffic periods.');

  return recs.slice(0, 5);
}
