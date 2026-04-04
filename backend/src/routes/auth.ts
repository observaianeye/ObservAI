
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
    password: z.string(),
    rememberMe: z.boolean().optional()
});

const ForgotPasswordSchema = z.object({
    email: z.string().email()
});

const ResetPasswordSchema = z.object({
    token: z.string(),
    password: z.string().min(8)
});

const ChangePasswordSchema = z.object({
    currentPassword: z.string(),
    newPassword: z.string().min(8)
});

// Helper to create session
const createSession = async (res: Response, userId: string, rememberMe = false) => {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    const days = rememberMe ? 30 : 7; // 30 days if remember me, otherwise 7 days
    expiresAt.setDate(expiresAt.getDate() + days);

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

        const trialExpiresAt = new Date();
        trialExpiresAt.setDate(trialExpiresAt.getDate() + 14);

        const user = await prisma.user.create({
            data: {
                email: data.email,
                passwordHash,
                firstName,
                lastName,
                role: 'MANAGER',
                accountType: 'TRIAL',
                trialExpiresAt,
                companyName: data.company || null
            }
        });

        await createSession(res, user.id);

        res.status(201).json({
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
            accountType: user.accountType,
            trialExpiresAt: user.trialExpiresAt?.toISOString() || null
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

        await createSession(res, user.id, data.rememberMe);

        res.json({
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
            accountType: user.accountType,
            trialExpiresAt: user.trialExpiresAt?.toISOString() || null
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
        role: user.role,
        accountType: user.accountType || 'TRIAL',
        trialExpiresAt: user.trialExpiresAt?.toISOString() || null
    });
});

// POST /api/auth/demo-login
router.post('/demo-login', async (req: Request, res: Response) => {
    try {
        const demoEmail = 'demo@observai.com';

        // Find or create demo user
        let demoUser = await prisma.user.findUnique({
            where: { email: demoEmail }
        });

        if (!demoUser) {
            const passwordHash = await bcrypt.hash('demo-readonly-' + crypto.randomBytes(8).toString('hex'), 10);
            demoUser = await prisma.user.create({
                data: {
                    email: demoEmail,
                    passwordHash,
                    firstName: 'Demo',
                    lastName: 'User',
                    role: 'VIEWER',
                    accountType: 'DEMO',
                    isActive: true
                }
            });
        }

        // Create short session (2 hours)
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 2);

        await prisma.session.create({
            data: { token, userId: demoUser.id, expiresAt }
        });

        res.cookie('session_token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            expires: expiresAt,
            path: '/'
        });

        res.json({
            id: demoUser.id,
            email: demoUser.email,
            firstName: demoUser.firstName,
            lastName: demoUser.lastName,
            role: demoUser.role,
            accountType: demoUser.accountType,
            trialExpiresAt: null
        });

    } catch (error) {
        console.error('Demo login error:', error);
        res.status(500).json({ error: 'Failed to start demo session' });
    }
});

// POST /api/auth/change-password
router.post('/change-password', authenticate, async (req: Request, res: Response) => {
    try {
        const data = ChangePasswordSchema.parse(req.body);
        const user = req.user;

        const fullUser = await prisma.user.findUnique({ where: { id: user.id } });
        if (!fullUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        const isValid = await bcrypt.compare(data.currentPassword, fullUser.passwordHash);
        if (!isValid) {
            return res.status(401).json({ error: 'Current password is incorrect' });
        }

        const passwordHash = await bcrypt.hash(data.newPassword, 10);
        await prisma.user.update({
            where: { id: user.id },
            data: { passwordHash }
        });

        res.json({ success: true, message: 'Password changed successfully' });

    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Validation error', details: error.errors });
        }
        console.error('Change password error:', error);
        res.status(500).json({ error: 'Failed to change password' });
    }
});

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req: Request, res: Response) => {
    try {
        const data = ForgotPasswordSchema.parse(req.body);

        // Find user by email
        const user = await prisma.user.findUnique({
            where: { email: data.email }
        });

        // Always return success to prevent email enumeration
        if (!user) {
            return res.json({ success: true, message: 'If an account exists, a reset link will be sent.' });
        }

        // Create reset token
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 1); // 1 hour expiry

        await prisma.passwordReset.create({
            data: {
                userId: user.id,
                token,
                expiresAt
            }
        });

        // In development, log the reset URL
        const resetUrl = `http://localhost:5173/reset-password?token=${token}`;
        console.log('\n' + '='.repeat(80));
        console.log('🔑 PASSWORD RESET REQUEST');
        console.log('='.repeat(80));
        console.log('📧 Email:', user.email);
        console.log('🔗 Reset URL:', resetUrl);
        console.log('⏰ Expires:', expiresAt.toLocaleString());
        console.log('⏱️  Valid for: 1 hour');
        console.log('='.repeat(80));
        console.log('⚠️  DEVELOPMENT MODE: Copy the URL above to reset password');
        console.log('⚠️  PRODUCTION: This would be sent via email');
        console.log('='.repeat(80) + '\n');

        // TODO: In production, send email here
        // await sendPasswordResetEmail(user.email, resetUrl);

        res.json({ success: true, message: 'If an account exists, a reset link will be sent.' });

    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Validation error', details: error.errors });
        }
        console.error('Forgot password error:', error);
        res.status(500).json({ error: 'Failed to process request' });
    }
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req: Request, res: Response) => {
    try {
        const data = ResetPasswordSchema.parse(req.body);

        // Find reset token
        const resetToken = await prisma.passwordReset.findUnique({
            where: { token: data.token },
            include: { user: true }
        });

        if (!resetToken) {
            return res.status(400).json({ error: 'Invalid or expired reset token' });
        }

        // Check if token is expired
        if (resetToken.expiresAt < new Date()) {
            return res.status(400).json({ error: 'Reset token has expired' });
        }

        // Check if token has been used
        if (resetToken.used) {
            return res.status(400).json({ error: 'Reset token has already been used' });
        }

        // Hash new password
        const passwordHash = await bcrypt.hash(data.password, 10);

        // Update user password
        await prisma.user.update({
            where: { id: resetToken.userId },
            data: { passwordHash }
        });

        // Mark token as used
        await prisma.passwordReset.update({
            where: { id: resetToken.id },
            data: { used: true }
        });

        console.log('✅ Password reset successful for:', resetToken.user.email);

        res.json({ success: true, message: 'Password has been reset successfully' });

    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Validation error', details: error.errors });
        }
        console.error('Reset password error:', error);
        res.status(500).json({ error: 'Failed to reset password' });
    }
});

export default router;
