import { Router, Request, Response } from 'express';
import { prisma } from '../lib/db';
import { z } from 'zod';
import { authenticate } from '../middleware/authMiddleware';

const router = Router();

const BranchSchema = z.object({
    name: z.string().min(1),
    city: z.string().min(1),
    latitude: z.number(),
    longitude: z.number(),
    timezone: z.string().optional(),
    isDefault: z.boolean().optional()
});

// GET /api/branches - List user's branches
router.get('/', authenticate, async (req: Request, res: Response) => {
    try {
        const branches = await prisma.branch.findMany({
            where: { userId: req.user.id },
            orderBy: { createdAt: 'desc' },
            include: {
                cameras: {
                    select: { id: true, name: true, isActive: true }
                }
            }
        });
        res.json(branches);
    } catch (error) {
        console.error('Get branches error:', error);
        res.status(500).json({ error: 'Failed to fetch branches' });
    }
});

// POST /api/branches - Create branch
router.post('/', authenticate, async (req: Request, res: Response) => {
    try {
        const data = BranchSchema.parse(req.body);

        // If this is set as default, unset other defaults
        if (data.isDefault) {
            await prisma.branch.updateMany({
                where: { userId: req.user.id, isDefault: true },
                data: { isDefault: false }
            });
        }

        const branch = await prisma.branch.create({
            data: {
                name: data.name,
                city: data.city,
                latitude: data.latitude,
                longitude: data.longitude,
                timezone: data.timezone || 'Europe/Istanbul',
                isDefault: data.isDefault || false,
                userId: req.user.id
            }
        });

        res.status(201).json(branch);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Validation error', details: error.errors });
        }
        console.error('Create branch error:', error);
        res.status(500).json({ error: 'Failed to create branch' });
    }
});

// PATCH /api/branches/:id - Update branch
router.patch('/:id', authenticate, async (req: Request, res: Response) => {
    try {
        const branch = await prisma.branch.findFirst({
            where: { id: req.params.id, userId: req.user.id }
        });
        if (!branch) {
            return res.status(404).json({ error: 'Branch not found' });
        }

        const data = BranchSchema.partial().parse(req.body);

        if (data.isDefault) {
            await prisma.branch.updateMany({
                where: { userId: req.user.id, isDefault: true },
                data: { isDefault: false }
            });
        }

        const updated = await prisma.branch.update({
            where: { id: req.params.id },
            data
        });

        res.json(updated);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Validation error', details: error.errors });
        }
        console.error('Update branch error:', error);
        res.status(500).json({ error: 'Failed to update branch' });
    }
});

// DELETE /api/branches/:id - Delete branch
router.delete('/:id', authenticate, async (req: Request, res: Response) => {
    try {
        const branch = await prisma.branch.findFirst({
            where: { id: req.params.id, userId: req.user.id }
        });
        if (!branch) {
            return res.status(404).json({ error: 'Branch not found' });
        }

        await prisma.branch.delete({ where: { id: req.params.id } });
        res.json({ success: true });
    } catch (error) {
        console.error('Delete branch error:', error);
        res.status(500).json({ error: 'Failed to delete branch' });
    }
});

// GET /api/branches/:id/weather - Get weather for branch location
router.get('/:id/weather', authenticate, async (req: Request, res: Response) => {
    try {
        const branch = await prisma.branch.findFirst({
            where: { id: req.params.id, userId: req.user.id }
        });
        if (!branch) {
            return res.status(404).json({ error: 'Branch not found' });
        }

        const weatherRes = await fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${branch.latitude}&longitude=${branch.longitude}&current_weather=true&hourly=precipitation_probability&forecast_days=1`
        );

        if (!weatherRes.ok) {
            return res.status(502).json({ error: 'Weather service unavailable' });
        }

        const weatherData = await weatherRes.json() as Record<string, unknown>;
        res.json({
            ...weatherData,
            branch: { id: branch.id, name: branch.name, city: branch.city }
        });
    } catch (error) {
        console.error('Weather fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch weather' });
    }
});

export default router;
