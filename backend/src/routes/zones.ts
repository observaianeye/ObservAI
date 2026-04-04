/**
 * Zone management API routes
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../lib/db';
import { z } from 'zod';
import { requireManager } from '../middleware/roleCheck';

const router = Router();

// Zone overlap detection helper
function coordsToBBox(coordinates: Array<{ x: number; y: number }>): { x: number; y: number; width: number; height: number } {
  const xs = coordinates.map(c => c.x);
  const ys = coordinates.map(c => c.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  return { x: minX, y: minY, width: Math.max(...xs) - minX, height: Math.max(...ys) - minY };
}

function rectsOverlap(
  r1: { x: number; y: number; width: number; height: number },
  r2: { x: number; y: number; width: number; height: number }
): boolean {
  return !(r1.x + r1.width <= r2.x || r2.x + r2.width <= r1.x || r1.y + r1.height <= r2.y || r2.y + r2.height <= r1.y);
}

function findOverlaps(
  newCoords: Array<{ x: number; y: number }>,
  existingZones: Array<{ coordinates: string | Array<{ x: number; y: number }> }>,
  excludeId?: string
): boolean {
  const newBBox = coordsToBBox(newCoords);
  for (const ez of existingZones) {
    if (excludeId && (ez as any).id === excludeId) continue;
    const coords = typeof ez.coordinates === 'string' ? JSON.parse(ez.coordinates) : ez.coordinates;
    if (rectsOverlap(newBBox, coordsToBBox(coords))) return true;
  }
  return false;
}

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

    // Parse JSON strings back to objects
    const parsedZones = zones.map(zone => ({
      ...zone,
      coordinates: typeof zone.coordinates === 'string' ? JSON.parse(zone.coordinates as string) : zone.coordinates
    }));

    res.json(parsedZones);
  } catch (error) {
    console.error('Error fetching zones:', error);
    res.status(500).json({ error: 'Failed to fetch zones' });
  }
});

// POST /api/zones - Create new zone
// Requires MANAGER role or higher
router.post('/', requireManager, async (req: Request, res: Response) => {
  try {
    const data = CreateZoneSchema.parse(req.body);

    // Check overlap with existing zones for this camera
    const existingZones = await prisma.zone.findMany({
      where: { cameraId: data.cameraId, isActive: true }
    });
    if (findOverlaps(data.coordinates, existingZones)) {
      return res.status(409).json({ error: 'Zone overlaps with an existing zone' });
    }

    const zone = await prisma.zone.create({
      data: {
        cameraId: data.cameraId,
        name: data.name,
        type: data.type,
        coordinates: JSON.stringify(data.coordinates),
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
// Requires MANAGER role or higher
router.put('/:id', requireManager, async (req: Request, res: Response) => {
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
// Requires MANAGER role or higher
router.delete('/:id', requireManager, async (req: Request, res: Response) => {
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
// Requires MANAGER role or higher
router.post('/batch', requireManager, async (req: Request, res: Response) => {
  try {
    const { cameraId, zones, createdBy } = req.body;

    if (!cameraId || !zones || !Array.isArray(zones)) {
      return res.status(400).json({ error: 'Invalid request body' });
    }

    // Check for overlaps among the batch zones themselves
    for (let i = 0; i < zones.length; i++) {
      for (let j = i + 1; j < zones.length; j++) {
        const coordsI = zones[i].coordinates || [];
        const coordsJ = zones[j].coordinates || [];
        if (coordsI.length > 0 && coordsJ.length > 0 && rectsOverlap(coordsToBBox(coordsI), coordsToBBox(coordsJ))) {
          return res.status(409).json({ error: `Zone "${zones[i].name}" overlaps with "${zones[j].name}"` });
        }
      }
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
        coordinates: JSON.stringify(zone.coordinates),
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
