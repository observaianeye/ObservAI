/**
 * ObservAI Backend API Server
 * REST API for database operations and data persistence
 */

import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDatabase, disconnectDatabase, checkDatabaseHealth, prisma } from './lib/db';
import camerasRouter from './routes/cameras';
import zonesRouter from './routes/zones';
import analyticsRouter from './routes/analytics';
import usersRouter from './routes/users';
import pythonBackendRouter from './routes/python-backend';
import aiRouter from './routes/ai';
import exportRouter from './routes/export';
import insightsRouter from './routes/insights';
import branchesRouter from './routes/branches';
import notificationsRouter from './routes/notifications';
import { pythonBackendManager } from './lib/pythonBackendManager';
import { getKafkaConsumer } from './lib/kafkaConsumer';
import cookieParser from 'cookie-parser';
import authRouter from './routes/auth';
import { checkOllamaHealth } from './routes/ai';
// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/health', async (req: Request, res: Response) => {
  const dbHealthy = await checkDatabaseHealth();
  res.status(dbHealthy ? 200 : 503).json({
    status: dbHealthy ? 'healthy' : 'unhealthy',
    database: dbHealthy ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString()
  });
});

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/cameras', camerasRouter);
app.use('/api/zones', zonesRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/users', usersRouter);
app.use('/api/python-backend', pythonBackendRouter);
app.use('/api/ai', aiRouter);
app.use('/api/export', exportRouter);
app.use('/api/insights', insightsRouter);
app.use('/api/branches', branchesRouter);
app.use('/api/notifications', notificationsRouter);

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err: Error, req: Request, res: Response, next: any) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

// insights tablosunu otomatik oluştur (migrasyon uygulanmamışsa)
async function ensureInsightsTable() {
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "insights" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "cameraId" TEXT NOT NULL,
        "zoneId" TEXT,
        "type" TEXT NOT NULL,
        "severity" TEXT NOT NULL DEFAULT 'medium',
        "title" TEXT NOT NULL,
        "message" TEXT NOT NULL,
        "context" TEXT,
        "isRead" BOOLEAN NOT NULL DEFAULT false,
        "expiresAt" DATETIME,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "insights_cameraId_createdAt_idx" ON "insights"("cameraId", "createdAt")
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "insights_type_severity_idx" ON "insights"("type", "severity")
    `);
    console.log('✅ insights tablosu hazır');
  } catch (err) {
    console.warn('⚠️  insights tablosu oluşturulamadı:', err);
  }
}

// Start server
async function startServer() {
  try {
    // Try to connect to database (optional for now)
    try {
      await connectDatabase();
      console.log('✅ Database connected');
      // Ensure insights table exists (migrasyon uygulanmamış olabilir)
      await ensureInsightsTable();
    } catch (dbError) {
      console.warn('⚠️  Database connection failed (continuing without DB):', (dbError as Error).message);
      console.warn('   Python backend manager will still work!');
    }

    // Check Ollama status at startup
    try {
      const ollamaHealth = await checkOllamaHealth();
      const AI_PROVIDER = process.env.AI_PROVIDER || 'ollama';
      if (ollamaHealth.status === 'online') {
        console.log(`✅ Ollama connected (${ollamaHealth.url}), model: ${ollamaHealth.selectedModel}`);
      } else if (ollamaHealth.status === 'no_models') {
        console.warn(`⚠️  Ollama is running but has no models. Run: ollama pull llama3.1:8b`);
      } else {
        console.warn(`⚠️  Ollama is offline (${ollamaHealth.url}).`);
        if (AI_PROVIDER === 'ollama') {
          if (process.env.GEMINI_API_KEY) {
            console.warn('   Gemini fallback is available.');
          } else {
            console.warn('   No AI fallback configured. AI features will be unavailable.');
            console.warn('   Start Ollama or set GEMINI_API_KEY in .env');
          }
        }
      }
    } catch {
      console.warn('⚠️  Could not check Ollama status');
    }

    // // Auto-start Python backend
    // try {
    //   console.log('🔄 Auto-starting Python backend on port 5001...');
    //   // Default to source 0 (Webcam)
    //   await pythonBackendManager.start({
    //     source: 0,
    //     wsPort: 5001
    //   });
    // } catch (pyError) {
    //   console.error('⚠️ Failed to auto-start Python backend:', pyError);
    // }

    // Start Kafka consumer if enabled
    try {
      const kafkaConsumer = getKafkaConsumer();
      if (kafkaConsumer.isConnected() || process.env.KAFKA_ENABLED === 'true') {
        console.log('🔄 Starting Kafka consumer...');
        await kafkaConsumer.connect();
      }
    } catch (kafkaError) {
      console.error('⚠️ Failed to start Kafka consumer:', kafkaError);
    }

    // Start Express server
    app.listen(PORT, () => {
      console.log(`🚀 ObservAI Backend API running on http://localhost:${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/health`);
      console.log(`🐍 Python Backend Manager: http://localhost:${PORT}/api/python-backend/status`);
      console.log(`📚 API endpoints:`);
      console.log(`   - POST   /api/python-backend/start`);
      console.log(`   - POST   /api/python-backend/stop`);
      console.log(`   - GET    /api/python-backend/status`);
      console.log(`   - POST   /api/cameras`);
      console.log(`   - GET    /api/cameras`);
      console.log(`   - POST   /api/zones`);
      console.log(`   - GET    /api/zones/:cameraId`);
      console.log(`   - POST   /api/analytics`);
      console.log(`   - GET    /api/analytics/:cameraId`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  await pythonBackendManager.stop();
  const kafkaConsumer = getKafkaConsumer();
  await kafkaConsumer.disconnect();
  await disconnectDatabase();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...');
  await pythonBackendManager.stop();
  const kafkaConsumer = getKafkaConsumer();
  await kafkaConsumer.disconnect();
  await disconnectDatabase();
  process.exit(0);
});

startServer();
