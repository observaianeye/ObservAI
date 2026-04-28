import { Router, Request, Response } from 'express';
import { prisma } from '../lib/db';
import { z } from 'zod';
import { authenticate } from '../middleware/authMiddleware';
import { utf8String } from '../lib/utf8Validator';

const router = Router();

// Yan #34 yayilim: branch name + city are user-rendered everywhere (top
// nav, weather widget, exports). utf8String rejects U+FFFD and lone
// surrogates so a once-corrupted ingest can't put garbage on the screen.
const BranchSchema = z.object({
    name: utf8String(1, 120),
    city: utf8String(1, 200),
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

// GET /api/branches/:id/traffic - Get traffic congestion for branch location
router.get('/:id/traffic', authenticate, async (req: Request, res: Response) => {
    try {
        const branch = await prisma.branch.findFirst({
            where: { id: req.params.id, userId: req.user.id }
        });
        if (!branch) {
            return res.status(404).json({ error: 'Branch not found' });
        }

        const traffic = await fetchTrafficData(branch.latitude, branch.longitude, branch.timezone);
        res.json({
            ...traffic,
            branch: { id: branch.id, name: branch.name, city: branch.city }
        });
    } catch (error) {
        console.error('Traffic fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch traffic' });
    }
});

interface TrafficResult {
    congestion: number;
    level: 'low' | 'medium' | 'high';
    currentSpeed?: number;
    freeFlowSpeed?: number;
    confidence?: number;
    source: 'tomtom' | 'heuristic';
    localHour: number;
}

export async function fetchTrafficData(
    latitude: number,
    longitude: number,
    timezone: string
): Promise<TrafficResult> {
    const localHour = getLocalHour(timezone);
    const isWeekend = getLocalWeekday(timezone) >= 5;

    const apiKey = process.env.TOMTOM_API_KEY;
    if (apiKey) {
        try {
            const url = `https://api.tomtom.com/traffic/services/4/flowSegmentData/relative0/10/json?point=${latitude},${longitude}&key=${apiKey}`;
            const r = await fetch(url);
            if (r.ok) {
                const j = await r.json() as { flowSegmentData?: { currentSpeed?: number; freeFlowSpeed?: number; confidence?: number } };
                const f = j.flowSegmentData;
                if (f && typeof f.currentSpeed === 'number' && typeof f.freeFlowSpeed === 'number' && f.freeFlowSpeed > 0) {
                    const congestion = Math.max(0, Math.min(1, 1 - f.currentSpeed / f.freeFlowSpeed));
                    return {
                        congestion,
                        level: congestion > 0.5 ? 'high' : congestion > 0.25 ? 'medium' : 'low',
                        currentSpeed: f.currentSpeed,
                        freeFlowSpeed: f.freeFlowSpeed,
                        confidence: f.confidence,
                        source: 'tomtom',
                        localHour,
                    };
                }
            }
        } catch (err) {
            console.warn('TomTom traffic API failed, falling back to heuristic:', err);
        }
    }

    const congestion = heuristicCongestion(localHour, isWeekend);
    return {
        congestion,
        level: congestion > 0.5 ? 'high' : congestion > 0.25 ? 'medium' : 'low',
        source: 'heuristic',
        localHour,
    };
}

function getLocalHour(timezone: string): number {
    try {
        const fmt = new Intl.DateTimeFormat('en-US', { timeZone: timezone, hour: 'numeric', hour12: false });
        const h = parseInt(fmt.format(new Date()), 10);
        return Number.isFinite(h) ? h % 24 : new Date().getHours();
    } catch {
        return new Date().getHours();
    }
}

function getLocalWeekday(timezone: string): number {
    try {
        const fmt = new Intl.DateTimeFormat('en-US', { timeZone: timezone, weekday: 'short' });
        const day = fmt.format(new Date());
        const map: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
        return map[day] ?? new Date().getDay();
    } catch {
        return new Date().getDay();
    }
}

function heuristicCongestion(hour: number, isWeekend: boolean): number {
    if (isWeekend) {
        if (hour >= 12 && hour <= 14) return 0.45;
        if (hour >= 18 && hour <= 21) return 0.5;
        if (hour >= 22 || hour <= 8) return 0.1;
        return 0.3;
    }
    if (hour >= 7 && hour <= 9) return 0.7;
    if (hour >= 17 && hour <= 19) return 0.75;
    if (hour >= 12 && hour <= 13) return 0.4;
    if (hour >= 22 || hour <= 6) return 0.08;
    return 0.25;
}

export default router;
