
import { Router, Request, Response } from 'express';
import { prisma } from '../lib/db';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import crypto from 'crypto';
import { authenticate } from '../middleware/authMiddleware';

const router = Router();

// Validation schemas
const RegisterSchema = z.object({
    email: z.string().email(),
    password: z.string().min(8),
    name: z.string().optional(),
    company: z.string().optional()
});

const LoginSchema = z.object({
    email: z.string().email(),
    password: z.string()
});

// Helper to create session
const createSession = async (res: Response, userId: string) => {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

    await prisma.session.create({
        data: {
            token,
            userId,
            expiresAt
        }
    });

    res.cookie('session_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        expires: expiresAt,
        path: '/'
    });
};

// POST /api/auth/register
router.post('/register', async (req: Request, res: Response) => {
    try {
        const data = RegisterSchema.parse(req.body);

        const existingUser = await prisma.user.findUnique({
            where: { email: data.email }
        });

        if (existingUser) {
            return res.status(400).json({ error: 'User already exists' });
        }

        const passwordHash = await bcrypt.hash(data.password, 10);

        // Split name into first and last if provided
        let firstName = '';
        let lastName = '';
        if (data.name) {
            const parts = data.name.split(' ');
            firstName = parts[0];
            lastName = parts.slice(1).join(' ');
        }

        const user = await prisma.user.create({
            data: {
                email: data.email,
                passwordHash,
                firstName,
                lastName,
                role: 'MANAGER' // Default role
            }
        });

        await createSession(res, user.id);

        res.status(201).json({
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role
        });

    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Validation error', details: error.errors });
        }
        console.error('Register error:', error);
        res.status(500).json({ error: 'Failed to register user' });
    }
});

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
    try {
        const data = LoginSchema.parse(req.body);

        const user = await prisma.user.findUnique({
            where: { email: data.email }
        });

        if (!user || !user.isActive) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const isValid = await bcrypt.compare(data.password, user.passwordHash);

        if (!isValid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Update last login
        await prisma.user.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() }
        });

        await createSession(res, user.id);

        res.json({
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role
        });

    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Validation error', details: error.errors });
        }
        console.error('Login error:', error);
        res.status(500).json({ error: 'Failed to login' });
    }
});

// POST /api/auth/logout
router.post('/logout', async (req: Request, res: Response) => {
    const token = req.cookies.session_token;

    if (token) {
        try {
            await prisma.session.delete({
                where: { token }
            });
        } catch (ignore) {
            // Session might already be missing
        }
    }

    res.clearCookie('session_token');
    res.json({ success: true });
});

// GET /api/auth/me
router.get('/me', authenticate, (req: Request, res: Response) => {
    const user = req.user;
    res.json({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role
    });
});

export default router;
