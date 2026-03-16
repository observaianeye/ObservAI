/**
 * Python Backend Control Routes
 * API endpoints for starting/stopping the Python camera analytics backend
 */

import { Router, Request, Response } from 'express';
import { pythonBackendManager } from '../lib/pythonBackendManager';
import { requireManager } from '../middleware/roleCheck';

const router = Router();

/**
 * POST /api/python-backend/start
 * Start the Python backend with given configuration
 * Requires MANAGER role or higher
 */
router.post('/start', requireManager, async (req: Request, res: Response) => {
  try {
    const { source, wsPort, wsHost } = req.body;

    // Validate source
    if (source === undefined || source === null) {
      return res.status(400).json({
        error: 'Missing required field: source'
      });
    }

    // Start the Python backend
    const success = await pythonBackendManager.start({
      source,
      wsPort: wsPort || 5000,
      wsHost: wsHost || '0.0.0.0'
    });

    if (success) {
      res.json({
        message: 'Python backend started successfully',
        status: pythonBackendManager.getStatus()
      });
    } else {
      res.status(500).json({
        error: 'Failed to start Python backend'
      });
    }
  } catch (error: any) {
    console.error('Error starting Python backend:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * POST /api/python-backend/stop
 * Stop the Python backend
 * Requires MANAGER role or higher
 */
router.post('/stop', requireManager, async (req: Request, res: Response) => {
  try {
    const success = await pythonBackendManager.stop();

    if (success) {
      res.json({
        message: 'Python backend stopped successfully',
        status: pythonBackendManager.getStatus()
      });
    } else {
      res.status(500).json({
        error: 'Failed to stop Python backend'
      });
    }
  } catch (error: any) {
    console.error('Error stopping Python backend:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * GET /api/python-backend/status
 * Get current status of Python backend
 */
router.get('/status', (req: Request, res: Response) => {
  try {
    const status = pythonBackendManager.getStatus();
    res.json(status);
  } catch (error: any) {
    console.error('Error getting Python backend status:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * GET /api/python-backend/health
 * Proxy health-check to Python WebSocket server's /health endpoint.
 * Returns 200 when Python backend is ready, 503 otherwise.
 * No auth required — used by frontend connection state machine.
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const wsPort = pythonBackendManager.getStatus()?.config?.wsPort || 5001;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    const upstream = await fetch(`http://localhost:${wsPort}/health`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const body = await upstream.json();
    res.status(upstream.status).json(body);
  } catch (error: any) {
    // Python backend unreachable
    res.status(503).json({
      status: 'unreachable',
      phase: 'offline',
      model_loaded: false,
      source_connected: false,
      streaming: false,
      error: 'Python backend is not running or not reachable',
    });
  }
});

/**
 * POST /api/python-backend/restart
 * Restart the Python backend with new configuration
 * Requires MANAGER role or higher
 */
router.post('/restart', requireManager, async (req: Request, res: Response) => {
  try {
    const { source, wsPort, wsHost } = req.body;

    // Validate source
    if (source === undefined || source === null) {
      return res.status(400).json({
        error: 'Missing required field: source'
      });
    }

    // Stop first
    await pythonBackendManager.stop();

    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Start with new config
    const success = await pythonBackendManager.start({
      source,
      wsPort: wsPort || 5000,
      wsHost: wsHost || '0.0.0.0'
    });

    if (success) {
      res.json({
        message: 'Python backend restarted successfully',
        status: pythonBackendManager.getStatus()
      });
    } else {
      res.status(500).json({
        error: 'Failed to restart Python backend'
      });
    }
  } catch (error: any) {
    console.error('Error restarting Python backend:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

export default router;
