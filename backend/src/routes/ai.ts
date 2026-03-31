/**
 * AI Q&A Routes
 * Natural language interface powered by Google Gemini
 */

import { Router, Request, Response } from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { prisma } from '../lib/db';
import { z } from 'zod';

const router = Router();

// NOT: GEMINI_API_KEY ve genAI modül yüklenirken değil,
// her request'te okunuyor — dotenv.config() sonra çalıştığı için.

// Validation schema
const ChatRequestSchema = z.object({
  message: z.string().min(1),
  // UUID zorunluluğu kaldırıldı — 'sample-camera-1' gibi non-uuid ID'leri destekler
  cameraId: z.string().min(1).optional(),
});

/**
 * POST /api/ai/chat - Natural language Q&A
 *
 * Accepts user questions and returns AI-generated responses based on real-time analytics data
 */
// Error type guards and categorization
type GeminiErrorCode = 'NO_KEY' | 'QUOTA_EXCEEDED' | 'MODEL_NOT_FOUND' | 'AUTH_ERROR' | 'UPSTREAM_ERROR' | 'UNKNOWN';

interface ErrorResponse {
  error: string;
  errorCode: GeminiErrorCode;
  timestamp: string;
}

function categorizeGeminiError(error: unknown): { code: GeminiErrorCode; message: string; statusCode: number } {
  if (!(error instanceof Error)) {
    return {
      code: 'UNKNOWN',
      message: 'Bilinmeyen hata oluştu. Lütfen daha sonra tekrar deneyin.',
      statusCode: 500,
    };
  }

  const msg = error.message.toLowerCase();

  // NO_KEY: API key tanımlı değil
  if (msg.includes('api_key') && msg.includes('undefined')) {
    return {
      code: 'NO_KEY',
      message: 'Gemini API key tanımlı değil. backend/.env dosyasına GEMINI_API_KEY ekleyin.',
      statusCode: 503,
    };
  }

  // QUOTA_EXCEEDED: Kota limiti aşıldı
  if (msg.includes('quota') || msg.includes('429') || msg.includes('resource_exhausted')) {
    return {
      code: 'QUOTA_EXCEEDED',
      message: 'API kota limiti aşıldı. Lütfen bekleyin veya planı yükseltin.',
      statusCode: 429,
    };
  }

  // MODEL_NOT_FOUND: Model bulunamadı
  if (msg.includes('404') || msg.includes('model') || msg.includes('not found')) {
    return {
      code: 'MODEL_NOT_FOUND',
      message: 'Model bulunamadı. Desteklenen model listesi: gemini-2.5-flash, gemini-2.0-flash-001',
      statusCode: 502,
    };
  }

  // AUTH_ERROR: Geçersiz API key veya yetki sorunu
  if (msg.includes('403') || msg.includes('permission') || msg.includes('unauthorized') || msg.includes('invalid') && msg.includes('key')) {
    return {
      code: 'AUTH_ERROR',
      message: 'API key geçersiz veya yetkisiz. key\'i kontrol edin.',
      statusCode: 401,
    };
  }

  // UPSTREAM_ERROR: Diğer network hataları
  if (msg.includes('network') || msg.includes('econnrefused') || msg.includes('timeout')) {
    return {
      code: 'UPSTREAM_ERROR',
      message: 'Upstream AI servis hatası. Lütfen daha sonra tekrar deneyin.',
      statusCode: 502,
    };
  }

  return {
    code: 'UNKNOWN',
    message: 'Bilinmeyen AI servisi hatası.',
    statusCode: 500,
  };
}

router.post('/chat', async (req: Request, res: Response) => {
  try {
    const { message, cameraId } = ChatRequestSchema.parse(req.body);

    // Get recent analytics data for context
    const recentAnalytics = await getRecentAnalyticsContext(cameraId);

    // Build context for Gemini
    const contextPrompt = buildContextPrompt(message, recentAnalytics);

    // API key'i her request'te oku (dotenv.config() sonra çalıştığı için)
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
    if (!GEMINI_API_KEY) {
      const timestamp = new Date().toISOString();
      console.error('[AI] NO_KEY error at', timestamp);
      return res.status(503).json({
        error: 'Gemini API key tanımlı değil. backend/.env dosyasına GEMINI_API_KEY ekleyin.',
        errorCode: 'NO_KEY',
        timestamp,
      } as ErrorResponse);
    }
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

    // Call Gemini API — model öncelik sırası (test edildi, 2026-03-15):
    // gemini-2.5-flash: ÇALIŞIYOR ✓
    // gemini-2.0-flash-001: yedek
    // gemini-2.0-flash-lite: son yedek
    let modelName = 'gemini-2.5-flash';
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(contextPrompt);
      const response = await result.response;
      const aiResponse = response.text();

      res.json({
        message: aiResponse,
        timestamp: new Date().toISOString(),
        model: modelName
      });
      return;
    } catch (primaryErr: unknown) {
      const primaryErrMsg = primaryErr instanceof Error ? primaryErr.message.toLowerCase() : '';
      if (primaryErrMsg.includes('quota') || primaryErrMsg.includes('429') || primaryErrMsg.includes('404') || primaryErrMsg.includes('resource_exhausted')) {
        console.log(`[AI] ${modelName} unavailable, falling back to gemini-2.0-flash-001`);
        modelName = 'gemini-2.0-flash-001';
      } else {
        throw primaryErr;
      }
    }

    // Fallback model
    const model = genAI.getGenerativeModel({ model: modelName });
    const result = await model.generateContent(contextPrompt);
    const response = await result.response;
    const aiResponse = response.text();

    res.json({
      message: aiResponse,
      timestamp: new Date().toISOString(),
      model: modelName
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }

    const timestamp = new Date().toISOString();
    const { code, message, statusCode } = categorizeGeminiError(error);

    console.error(`[AI] ${code} error at ${timestamp}:`, error instanceof Error ? error.message : String(error));

    // Kategorize ve uygun response döndür
    return res.status(statusCode).json({
      error: message,
      errorCode: code,
      timestamp,
    } as ErrorResponse);
  }
});

/**
 * GET /api/ai/debug — Gemini API key ve model durumunu test eder
 */
interface DebugResponse {
  status: 'OK' | 'NO_KEY' | 'ERROR' | 'ALL_QUOTA_EXHAUSTED';
  model?: string;
  message?: string;
  keyPrefix: string;
}

router.get('/debug', async (req: Request, res: Response) => {
  const key = process.env.GEMINI_API_KEY || '';
  if (!key) {
    return res.json({
      status: 'NO_KEY',
      message: 'GEMINI_API_KEY tanımlı değil',
      keyPrefix: '[not-set]'
    } as DebugResponse);
  }

  const keyPrefix = key.slice(0, 8) + '...';

  // Test sırası — Chrome ile test edildi (2026-03-15)
  const candidates = ['gemini-2.5-flash', 'gemini-2.0-flash-001', 'gemini-2.0-flash-lite'];
  for (const m of candidates) {
    try {
      const genAI = new GoogleGenerativeAI(key);
      const model = genAI.getGenerativeModel({ model: m });
      const result = await model.generateContent('Say "OK" only.');
      return res.json({
        status: 'OK',
        model: m,
        message: result.response.text(),
        keyPrefix
      } as DebugResponse);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message.toLowerCase() : '';
      if (!errMsg.includes('quota') && !errMsg.includes('429') && !errMsg.includes('404') && !errMsg.includes('resource_exhausted')) {
        const errDetail = err instanceof Error ? err.message : 'Unknown error';
        console.error(`[AI Debug] ${m} error:`, errDetail);
        return res.json({
          status: 'ERROR',
          model: m,
          message: errDetail,
          keyPrefix
        } as DebugResponse);
      }
    }
  }
  return res.json({
    status: 'ALL_QUOTA_EXHAUSTED',
    message: `All candidates exhausted: ${candidates.join(', ')}`,
    keyPrefix
  } as DebugResponse);
});

/**
 * Fetch recent analytics data for context
 */
async function getRecentAnalyticsContext(cameraId?: string): Promise<string> {
  try {
    const where: any = {};
    if (cameraId) {
      where.cameraId = cameraId;
    }

    // Get recent analytics logs (last 100 entries)
    const logs = await prisma.analyticsLog.findMany({
      where,
      orderBy: {
        timestamp: 'desc'
      },
      take: 100,
      include: {
        camera: {
          select: {
            id: true,
            name: true,
            sourceType: true
          }
        }
      }
    });

    if (logs.length === 0) {
      return 'No recent analytics data available.';
    }

    // Calculate summary statistics
    const totalPeopleIn = logs.reduce((sum, log) => sum + log.peopleIn, 0);
    const totalPeopleOut = logs.reduce((sum, log) => sum + log.peopleOut, 0);
    const avgCurrentCount = Math.round(
      logs.reduce((sum, log) => sum + log.currentCount, 0) / logs.length
    );
    const avgQueueCount = logs.filter(l => l.queueCount !== null).length > 0
      ? Math.round(
        logs
          .filter(l => l.queueCount !== null)
          .reduce((sum, log) => sum + (log.queueCount || 0), 0) /
        logs.filter(l => l.queueCount !== null).length
      )
      : null;
    const avgWaitTime = logs.filter(l => l.avgWaitTime !== null).length > 0
      ? (
        logs
          .filter(l => l.avgWaitTime !== null)
          .reduce((sum, log) => sum + (log.avgWaitTime || 0), 0) /
        logs.filter(l => l.avgWaitTime !== null).length
      ).toFixed(1)
      : null;

    // Extract demographics data
    const demographics = extractDemographics(logs);

    // Get zone insights
    const zoneInsights = await getZoneInsights();

    // Build context string
    let context = '=== RECENT ANALYTICS DATA ===\n\n';

    if (logs[0].camera) {
      context += `Camera: ${logs[0].camera.name}\n`;
      context += `Type: ${logs[0].camera.sourceType}\n\n`;
    }

    context += `Time Range: ${logs[logs.length - 1].timestamp.toISOString()} to ${logs[0].timestamp.toISOString()}\n`;
    context += `Total Entries: ${logs.length}\n\n`;

    context += '--- Summary Statistics ---\n';
    context += `Total People Entered: ${totalPeopleIn}\n`;
    context += `Total People Exited: ${totalPeopleOut}\n`;
    context += `Current Count (Avg): ${avgCurrentCount}\n`;
    if (avgQueueCount !== null) {
      context += `Queue Count (Avg): ${avgQueueCount}\n`;
    }
    if (avgWaitTime !== null) {
      context += `Average Wait Time: ${avgWaitTime} seconds\n`;
    }

    if (demographics) {
      context += `\n--- Demographics ---\n${demographics}\n`;
    }

    if (zoneInsights) {
      context += `\n--- Zone Insights ---\n${zoneInsights}\n`;
    }

    // Hava durumu (Open-Meteo, ücretsiz, API key gerektirmiyor)
    try {
      const weatherRes = await fetch(
        'https://api.open-meteo.com/v1/forecast?latitude=39.9334&longitude=32.8597&current_weather=true&hourly=precipitation_probability&forecast_days=1'
      );
      if (weatherRes.ok) {
        const weatherData: any = await weatherRes.json();
        const cw = weatherData.current_weather;
        const wmoDesc: Record<number, string> = {
          0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
          45: 'Foggy', 51: 'Light drizzle', 61: 'Slight rain', 63: 'Moderate rain',
          65: 'Heavy rain', 71: 'Slight snow', 80: 'Rain showers', 95: 'Thunderstorm',
        };
        const desc = wmoDesc[cw.weathercode] || `Code ${cw.weathercode}`;
        const precipProb = weatherData.hourly?.precipitation_probability?.[new Date().getHours()] ?? null;
        context += `\n--- Current Weather (Ankara) ---\n`;
        context += `Temperature: ${cw.temperature}°C, ${desc}, Wind: ${cw.windspeed} km/h\n`;
        if (precipProb !== null) context += `Rain Probability: ${precipProb}%\n`;
      }
    } catch { /* hava durumu opsiyonel */ }

    // Add latest snapshot data
    const latestLog = logs[0];
    context += `\n--- Latest Snapshot (${latestLog.timestamp.toISOString()}) ---\n`;
    context += `People In: ${latestLog.peopleIn}\n`;
    context += `People Out: ${latestLog.peopleOut}\n`;
    context += `Current Count: ${latestLog.currentCount}\n`;
    if (latestLog.queueCount !== null) {
      context += `Queue Count: ${latestLog.queueCount}\n`;
    }
    if (latestLog.fps !== null) {
      context += `FPS: ${latestLog.fps}\n`;
    }

    return context;
  } catch (error) {
    console.error('Error fetching analytics context:', error);
    return 'Error fetching analytics data.';
  }
}

/**
 * Extract demographics summary from logs
 */
function extractDemographics(logs: any[]): string | null {
  try {
    const demographicsLogs = logs.filter(log => log.demographics && Object.keys(log.demographics).length > 0);

    if (demographicsLogs.length === 0) {
      return null;
    }

    // Aggregate demographics data
    const genderCounts: Record<string, number> = {};
    const ageCounts: Record<string, number> = {};

    demographicsLogs.forEach(log => {
      const demo = log.demographics as any;

      // Count genders
      if (demo.gender) {
        Object.entries(demo.gender).forEach(([gender, count]) => {
          genderCounts[gender] = (genderCounts[gender] || 0) + (count as number);
        });
      }

      // Count age groups
      if (demo.age) {
        Object.entries(demo.age).forEach(([age, count]) => {
          ageCounts[age] = (ageCounts[age] || 0) + (count as number);
        });
      }
    });

    let demoStr = '';

    if (Object.keys(genderCounts).length > 0) {
      demoStr += 'Gender Distribution:\n';
      Object.entries(genderCounts)
        .sort(([, a], [, b]) => b - a)
        .forEach(([gender, count]) => {
          demoStr += `  ${gender}: ${count}\n`;
        });
    }

    if (Object.keys(ageCounts).length > 0) {
      demoStr += '\nAge Distribution:\n';
      Object.entries(ageCounts)
        .sort(([, a], [, b]) => b - a)
        .forEach(([age, count]) => {
          demoStr += `  ${age}: ${count}\n`;
        });
    }

    return demoStr || null;
  } catch (error) {
    console.error('Error extracting demographics:', error);
    return null;
  }
}

/**
 * Get recent zone insights
 */
async function getZoneInsights(): Promise<string | null> {
  try {
    const insights = await prisma.zoneInsight.findMany({
      orderBy: {
        timestamp: 'desc'
      },
      take: 20,
      include: {
        zone: {
          select: {
            id: true,
            name: true,
            type: true
          }
        }
      }
    });

    if (insights.length === 0) {
      return null;
    }

    let insightsStr = '';
    insights.forEach((insight, index) => {
      insightsStr += `${index + 1}. ${insight.message}\n`;
      insightsStr += `   Zone: ${insight.zone?.name || insight.zoneId}\n`;
      insightsStr += `   Duration: ${Math.round(insight.duration / 60)} minutes\n`;
      if (insight.gender) {
        insightsStr += `   Gender: ${insight.gender}\n`;
      }
      if (insight.age) {
        insightsStr += `   Age: ${insight.age}\n`;
      }
      insightsStr += '\n';
    });

    return insightsStr;
  } catch (error) {
    console.error('Error fetching zone insights:', error);
    return null;
  }
}

/**
 * Build the full context prompt for Gemini
 */
function buildContextPrompt(userMessage: string, analyticsContext: string): string {
  return `You are an AI assistant for ObservAI, a real-time camera analytics platform for retail and cafe operations.
Your role is to help managers and operators understand their data and make informed decisions.

You have access to the following REAL-TIME analytics data from the venue:

${analyticsContext}

=== END OF DATA ===

User Question: ${userMessage}

Instructions:
- Answer the user's question based ONLY on the analytics data provided above
- Be concise and actionable (2-3 sentences maximum)
- Use specific numbers and metrics from the data
- If the data doesn't contain information to answer the question, say "I don't have enough data to answer that. The system is currently tracking [mention what data is available]."
- Format responses in a friendly, professional tone suitable for business managers
- Focus on actionable insights and recommendations
- When discussing trends, use the time range information provided

Answer:`;
}

export default router;
