/**
 * Zone management API routes
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../lib/db';
import { z } from 'zod';

const router = Router();

// Validation schemas
const CreateZoneSchema = z.object({
  cameraId: z.string().uuid(),
  name: z.string().min(1).max(255),
  type: z.enum(['ENTRANCE', 'EXIT', 'QUEUE', 'TABLE', 'CUSTOM']),
  coordinates: z.array(z.object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1)
  })),
  color: z.string().optional(),
  createdBy: z.string().uuid()
});

// GET /api/zones/:cameraId - Get zones for a camera
router.get('/:cameraId', async (req: Request, res: Response) => {
  try {
    const { cameraId } = req.params;

    const zones = await prisma.zone.findMany({
      where: {
        cameraId,
        isActive: true
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
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.json(zones);
  } catch (error) {
    console.error('Error fetching zones:', error);
    res.status(500).json({ error: 'Failed to fetch zones' });
  }
});

// POST /api/zones - Create new zone
router.post('/', async (req: Request, res: Response) => {
  try {
    const data = CreateZoneSchema.parse(req.body);

    const zone = await prisma.zone.create({
      data: {
        cameraId: data.cameraId,
        name: data.name,
        type: data.type,
        coordinates: data.coordinates,
        color: data.color || '#3b82f6',
        createdBy: data.createdBy
      },
      include: {
        camera: true,
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

    res.status(201).json(zone);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Error creating zone:', error);
    res.status(500).json({ error: 'Failed to create zone' });
  }
});

// PUT /api/zones/:id - Update zone
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const data = req.body;

    const zone = await prisma.zone.update({
      where: { id },
      data: {
        name: data.name,
        coordinates: data.coordinates,
        color: data.color,
        isActive: data.isActive
      }
    });

    res.json(zone);
  } catch (error) {
    console.error('Error updating zone:', error);
    res.status(500).json({ error: 'Failed to update zone' });
  }
});

// DELETE /api/zones/:id - Delete zone
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await prisma.zone.delete({
      where: { id }
    });

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting zone:', error);
    res.status(500).json({ error: 'Failed to delete zone' });
  }
});

// POST /api/zones/batch - Batch create/update zones for a camera
router.post('/batch', async (req: Request, res: Response) => {
  try {
    const { cameraId, zones, createdBy } = req.body;

    if (!cameraId || !zones || !Array.isArray(zones)) {
      return res.status(400).json({ error: 'Invalid request body' });
    }

    // Delete existing zones for this camera
    await prisma.zone.deleteMany({
      where: { cameraId }
    });

    // Create new zones
    const createdZones = await prisma.zone.createMany({
      data: zones.map((zone: any) => ({
        cameraId,
        name: zone.name,
        type: zone.type || 'CUSTOM',
        coordinates: zone.coordinates,
        color: zone.color || '#3b82f6',
        createdBy
      }))
    });

    res.status(201).json({ count: createdZones.count });
  } catch (error) {
    console.error('Error batch creating zones:', error);
    res.status(500).json({ error: 'Failed to batch create zones' });
  }
});

export default router;
