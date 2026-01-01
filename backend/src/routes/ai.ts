/**
 * AI Q&A Routes
 * Natural language interface powered by Google Gemini 3.0
 */

import { Router, Request, Response } from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { prisma } from '../lib/db';
import { z } from 'zod';

const router = Router();

// Initialize Gemini API
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'AIzaSyCWHOJxdWO_GF0foPfSbkHSYcfnfYn1nrQ';
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// Validation schema
const ChatRequestSchema = z.object({
  message: z.string().min(1),
  cameraId: z.string().uuid().optional(),
});

/**
 * POST /api/ai/chat - Natural language Q&A
 *
 * Accepts user questions and returns AI-generated responses based on real-time analytics data
 */
router.post('/chat', async (req: Request, res: Response) => {
  try {
    const { message, cameraId } = ChatRequestSchema.parse(req.body);

    // Get recent analytics data for context
    const recentAnalytics = await getRecentAnalyticsContext(cameraId);

    // Build context for Gemini
    const contextPrompt = buildContextPrompt(message, recentAnalytics);

    // Call Gemini API
    // Try Gemini 3.0 first, fallback to 1.5 Flash if quota exceeded
    let modelName = 'gemini-3-pro-preview';
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
    } catch (gemini3Error: any) {
      // If Gemini 3.0 fails due to quota/not found, try older stable model
      if (gemini3Error?.message?.includes('quota') || gemini3Error?.message?.includes('429') || gemini3Error?.message?.includes('404')) {
        console.log('[AI] Gemini 3.0 unavailable, falling back to Gemini Pro (stable)');
        modelName = 'gemini-pro';
      } else {
        throw gemini3Error;
      }
    }

    // Fallback to stable Gemini Pro
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
    console.error('AI Chat Error:', error);

    // Demo mode fallback when API key is invalid/quota exceeded
    if (error instanceof Error && (error.message.includes('404') || error.message.includes('quota') || error.message.includes('429'))) {
      console.log('[AI] Gemini API unavailable, using demo response');
      return res.json({
        message: `I don't have enough data to answer that. The system is currently tracking visitor counts, demographics (age/gender), queue metrics, and zone occupancy.

**Note**: AI integration requires a valid Gemini API key with proper quota. Please configure \`GEMINI_API_KEY\` in your environment variables.`,
        timestamp: new Date().toISOString(),
        model: 'demo-mode'
      });
    }

    res.status(500).json({
      error: 'Failed to process chat request',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
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
