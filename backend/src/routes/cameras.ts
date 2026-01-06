/**
 * Camera management API routes
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../lib/db';
import { z } from 'zod';
import { requireManager, requireAdmin } from '../middleware/roleCheck';

const router = Router();

// Validation schemas
const CreateCameraSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  sourceType: z.enum(['WEBCAM', 'FILE', 'RTSP', 'RTMP', 'HTTP', 'YOUTUBE', 'SCREEN_CAPTURE']),
  sourceValue: z.string().min(1),
  config: z.record(z.any()).optional(),
  createdBy: z.string().uuid()
});

// GET /api/cameras - List all cameras
router.get('/', async (req: Request, res: Response) => {
  try {
    const cameras = await prisma.camera.findMany({
      include: {
        zones: true,
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Parse JSON strings back to objects
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

// GET /api/cameras/:id - Get single camera
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const camera = await prisma.camera.findUnique({
      where: { id },
      include: {
        zones: true,
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true
          }
        }
      }
    });

    if (!camera) {
      return res.status(404).json({ error: 'Camera not found' });
    }

    res.json(camera);
  } catch (error) {
    console.error('Error fetching camera:', error);
    res.status(500).json({ error: 'Failed to fetch camera' });
  }
});

// POST /api/cameras - Create new camera
// Requires MANAGER role or higher
router.post('/', requireManager, async (req: Request, res: Response) => {
  try {
    const data = CreateCameraSchema.parse(req.body);

    const camera = await prisma.camera.create({
      data: {
        name: data.name,
        description: data.description,
        sourceType: data.sourceType,
        sourceValue: data.sourceValue,
        config: data.config ? JSON.stringify(data.config) : undefined,
        createdBy: data.createdBy
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true
          }
        }
      }
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

// PUT /api/cameras/:id - Update camera
// Requires MANAGER role or higher
router.put('/:id', requireManager, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const data = req.body;

    const camera = await prisma.camera.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        sourceValue: data.sourceValue,
        isActive: data.isActive,
        config: data.config
      }
    });

    res.json(camera);
  } catch (error) {
    console.error('Error updating camera:', error);
    res.status(500).json({ error: 'Failed to update camera' });
  }
});

// DELETE /api/cameras/:id - Delete camera
// Requires ADMIN role only
router.delete('/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await prisma.camera.delete({
      where: { id }
    });

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting camera:', error);
    res.status(500).json({ error: 'Failed to delete camera' });
  }
});

export default router;
