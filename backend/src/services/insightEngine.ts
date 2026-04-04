/**
 * ObservAI Insight Engine
 *
 * AI-powered analytics insight generation service.
 * Generates real-time alerts, trend analysis, and Gemini-powered recommendations.
 *
 * Insight Types:
 * - occupancy_alert: Zone capacity > 80%
 * - wait_time_alert: Person in zone > threshold
 * - crowd_surge: Sudden visitor spike (>1.5x rolling average)
 * - trend: Peak hours, demographic shifts, zone comparisons
 * - recommendation: Gemini AI-generated business suggestions
 * - demographic_trend: Morning vs evening demographic profiles
 */

import { prisma } from '../lib/db';
import { GoogleGenerativeAI } from '@google/generative-ai';

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

  const [logs, alertCountResult, alertsBySeverityResult] = await Promise.all([
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
  ]);
  const alertCount = Number(alertCountResult[0]?.cnt || 0);
  const alertsBySeverity = alertsBySeverityResult;

  const totalVisitors = logs.reduce((s, l) => s + l.peopleIn, 0);
  const avgOccupancy = logs.length > 0
    ? round2(logs.reduce((s, l) => s + l.currentCount, 0) / logs.length)
    : 0;
  const peakOccupancy = logs.length > 0
    ? Math.max(...logs.map(l => l.currentCount))
    : 0;

  // Peak hour
  const hourCounts: Record<number, number> = {};
  logs.forEach(l => {
    const h = new Date(l.timestamp).getHours();
    hourCounts[h] = (hourCounts[h] || 0) + l.currentCount;
  });
  const peakEntry = Object.entries(hourCounts).sort(([, a], [, b]) => b - a)[0];
  const peakHour = peakEntry ? `${peakEntry[0]}:00` : 'N/A';

  const severityMap: Record<string, number> = {};
  alertsBySeverity.forEach(a => {
    severityMap[a.severity] = Number(a.cnt);
  });

  const demographics = extractDemographicProfile(logs);

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
 * Generate AI-powered recommendations using Gemini API.
 */
export async function getAIRecommendations(cameraId?: string): Promise<string[]> {
  try {
    // Gather analytics context
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

    // Build context summary
    const totalVisitors = logs.reduce((s, l) => s + l.peopleIn, 0);
    const avgOccupancy = logs.length > 0
      ? round2(logs.reduce((s, l) => s + l.currentCount, 0) / logs.length)
      : 0;
    const peakCount = logs.length > 0 ? Math.max(...logs.map(l => l.currentCount)) : 0;
    const demographics = extractDemographicProfile(logs);

    // Build zone insight summary
    const zoneSummary = zoneInsights.slice(0, 10).map(zi =>
      `- ${zi.zone?.name || 'Unknown zone'}: Person stayed ${Math.round(zi.duration / 60)} min` +
      (zi.gender ? ` (${zi.gender}` + (zi.age ? `, age ~${zi.age}` : '') + ')' : '')
    ).join('\n');

    // Build alerts summary
    const alertSummary = recentInsights.slice(0, 5).map(i =>
      `- [${i.severity.toUpperCase()}] ${i.title}: ${i.message}`
    ).join('\n');

    // Hava durumu verisini al (Open-Meteo, ücretsiz)
    const weatherCtx = await getWeatherContext();

    const contextStr = `
=== LAST 24-HOUR ANALYTICS SUMMARY ===
Total Visitors: ${totalVisitors}
Average Occupancy: ${avgOccupancy}
Peak Occupancy: ${peakCount}
Data Points: ${logs.length}

${weatherCtx ? `Weather Context:\n  ${weatherCtx}` : ''}

${demographics ? `Demographics:
  Dominant Gender: ${demographics.dominantGender}
  Dominant Age Group: ${demographics.dominantAgeGroup}
  Gender: ${JSON.stringify(demographics.genderDistribution)}
  Ages: ${JSON.stringify(demographics.ageDistribution)}` : 'Demographics: Not available'}

${zoneSummary ? `Zone Alerts:\n${zoneSummary}` : 'Zone Alerts: None'}

${alertSummary ? `Recent Alerts:\n${alertSummary}` : 'Recent Alerts: None'}
`;

    const prompt = `You are an AI analytics advisor for ObservAI, a real-time visitor analytics platform used in retail stores and cafes.

Based on the following analytics data, provide exactly 5 actionable business recommendations. Each recommendation should be specific, data-driven, and implementable.

${contextStr}

Format: Return ONLY a JSON array of 5 strings, each a concise recommendation (1-2 sentences).
Example: ["Recommendation 1", "Recommendation 2", ...]

Recommendations:`;

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
    if (!GEMINI_API_KEY) {
      return getDemoRecommendations(totalVisitors, avgOccupancy, demographics);
    }

    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    // Model öncelik sırası — test edildi (2026-03-15)
    const modelCandidates = ['gemini-2.5-flash', 'gemini-2.0-flash-001', 'gemini-2.0-flash-lite'];

    for (const modelName of modelCandidates) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent(prompt);
        const text = result.response.text();

        console.log(`[Gemini] model: ${modelName}, status: success`);

        const jsonMatch = text.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (Array.isArray(parsed)) return parsed.map(String).slice(0, 5);
        }
        return text.split('\n').filter(l => l.trim().length > 10).slice(0, 5);
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        const isQuotaOrMissing =
          errMsg.toLowerCase().includes('quota') || errMsg.toLowerCase().includes('429') ||
          errMsg.toLowerCase().includes('404') || errMsg.toLowerCase().includes('resource_exhausted');

        if (isQuotaOrMissing) {
          console.log(`[Gemini] model: ${modelName}, status: quota_exhausted`);
        } else {
          console.error(`[Gemini] model: ${modelName}, status: error, error: ${errMsg}`);
          throw err;
        }
      }
    }
    console.log('[Gemini] All models exhausted, returning demo recommendations');
    return getDemoRecommendations(totalVisitors, avgOccupancy, demographics);
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('[Gemini] error generating recommendations:', errMsg);
    return getDemoRecommendations();
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
