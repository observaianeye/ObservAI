/**
 * Camera management API routes — tenant-scoped to req.user.id.
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../lib/db';
import { z } from 'zod';
import { requireManager } from '../middleware/roleCheck';
import { authenticate } from '../middleware/authMiddleware';
import { requireCameraOwnership, userOwnsCamera } from '../middleware/tenantScope';
import { utf8String } from '../lib/utf8Validator';
import { pythonBackendManager } from '../lib/pythonBackendManager';

const router = Router();

// Yan #34 yayilim: camera name renders in TopNavbar, dashboard cards,
// and PDF/CSV exports. UTF-8 refine guards against U+FFFD ingest.
const CreateCameraSchema = z.object({
  name: utf8String(1, 255),
  description: z.string().optional(),
  // Issue #2: SCREEN_CAPTURE removed from accepted source types — was a leftover
  // dev affordance, never used in production, and the desktop screen-grab path
  // adds maintenance surface (mss dep, Ultralytics 'screen' magic) we don't want.
  sourceType: z.enum(['WEBCAM', 'FILE', 'RTSP', 'RTMP', 'HTTP', 'YOUTUBE', 'PHONE']),
  sourceValue: z.string().min(1),
  config: z.record(z.any()).optional(),
  branchId: z.string().uuid().optional(),
});

// GET /api/cameras - List the caller's cameras (optionally scoped to a branch)
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const branchId = typeof req.query.branchId === 'string' ? req.query.branchId.trim() : '';
    const cameras = await prisma.camera.findMany({
      where: {
        createdBy: req.user.id,
        ...(branchId ? { branchId } : {}),
      },
      include: { zones: true },
      orderBy: { createdAt: 'desc' },
    });

    const parsedCameras = cameras.map(camera => ({
      ...camera,
      config: camera.config ? JSON.parse(camera.config as string) : undefined,
    }));

    res.json(parsedCameras);
  } catch (error) {
    console.error('Error fetching cameras:', error);
    res.status(500).json({ error: 'Failed to fetch cameras' });
  }
});

// GET /api/cameras/active - Get the caller's active camera (optionally per branch)
router.get('/active', authenticate, async (req: Request, res: Response) => {
  try {
    const branchId = typeof req.query.branchId === 'string' ? req.query.branchId.trim() : '';
    const camera = await prisma.camera.findFirst({
      where: {
        createdBy: req.user.id,
        isActive: true,
        ...(branchId ? { branchId } : {}),
      },
      include: { zones: true },
    });
    res.json(camera);
  } catch (error) {
    console.error('Error fetching active camera:', error);
    res.status(500).json({ error: 'Failed to fetch active camera' });
  }
});

// POST /api/cameras/activate/:id - Activate one of the caller's cameras
router.post('/activate/:id', authenticate, requireCameraOwnership('id'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Deactivate only the caller's other cameras
    await prisma.camera.updateMany({
      where: { createdBy: req.user.id },
      data: { isActive: false },
    });

    const camera = await prisma.camera.update({
      where: { id },
      data: { isActive: true },
    });

    // Faz 10 Bug #4 — push the new camera id to the Python pipeline so the
    // NodePersister rebinds and starts emitting tagged analytics_logs rows
    // immediately. Best-effort: failures (Python offline) don't fail the
    // activation request — the user can switch cameras even when the engine
    // is down, persistence resumes when Python comes back online via the
    // health-monitor rebind hook.
    pythonBackendManager.setCamera(id).catch(() => undefined);

    res.json(camera);
  } catch (error) {
    console.error('Error activating camera:', error);
    res.status(500).json({ error: 'Failed to activate camera' });
  }
});

// GET /api/cameras/:id - Get a single owned camera
router.get('/:id', authenticate, requireCameraOwnership('id'), async (req: Request, res: Response) => {
  try {
    const camera = await prisma.camera.findUnique({
      where: { id: req.params.id },
      include: { zones: true },
    });

    if (!camera) return res.status(404).json({ error: 'Camera not found' });

    res.json({
      ...camera,
      config: camera.config ? JSON.parse(camera.config as string) : undefined,
    });
  } catch (error) {
    console.error('Error fetching camera:', error);
    res.status(500).json({ error: 'Failed to fetch camera' });
  }
});

// POST /api/cameras - Create new camera owned by the caller
router.post('/', requireManager, async (req: Request, res: Response) => {
  try {
    const data = CreateCameraSchema.parse(req.body);

    // If branch is supplied it must belong to the caller
    if (data.branchId) {
      const branch = await prisma.branch.findFirst({
        where: { id: data.branchId, userId: req.user.id },
        select: { id: true },
      });
      if (!branch) return res.status(404).json({ error: 'Branch not found' });
    }

    const camera = await prisma.camera.create({
      data: {
        name: data.name,
        description: data.description,
        sourceType: data.sourceType,
        sourceValue: data.sourceValue,
        config: data.config ? JSON.stringify(data.config) : undefined,
        createdBy: req.user.id,
        branchId: data.branchId,
      },
    });

    res.status(201).json(camera);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Error creating camera:', error);
    res.status(500).json({ error: 'Failed to create camera' });
  }
});

// PUT /api/cameras/:id - Update an owned camera
router.put('/:id', requireManager, requireCameraOwnership('id'), async (req: Request, res: Response) => {
  try {
    const data = req.body;
    const camera = await prisma.camera.update({
      where: { id: req.params.id },
      data: {
        name: data.name,
        description: data.description,
        sourceValue: data.sourceValue,
        isActive: data.isActive,
        config: data.config,
      },
    });
    res.json(camera);
  } catch (error) {
    console.error('Error updating camera:', error);
    res.status(500).json({ error: 'Failed to update camera' });
  }
});

// DELETE /api/cameras/:id - Delete an owned camera (Manager+ on own data)
router.delete('/:id', requireManager, requireCameraOwnership('id'), async (req: Request, res: Response) => {
  try {
    await prisma.camera.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting camera:', error);
    res.status(500).json({ error: 'Failed to delete camera' });
  }
});

export default router;
