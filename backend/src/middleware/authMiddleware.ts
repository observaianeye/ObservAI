
import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/db';

// Extend Express Request type to include user
declare global {
    namespace Express {
        interface Request {
            user?: any;
        }
    }
}

export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const token = req.cookies.session_token;

        if (!token) {
            return res.status(401).json({ error: 'Unauthorized: No session token found' });
        }

        const session = await prisma.session.findUnique({
            where: { token },
            include: { user: true }
        });

        if (!session) {
            // Clear invalid cookie
            res.clearCookie('session_token');
            return res.status(401).json({ error: 'Unauthorized: Invalid session' });
        }

        if (session.expiresAt < new Date()) {
            // Session expired
            await prisma.session.delete({ where: { id: session.id } });
            res.clearCookie('session_token');
            return res.status(401).json({ error: 'Unauthorized: Session expired' });
        }

        // Attach user to request
        req.user = session.user;
        next();
    } catch (error) {
        console.error('Auth middleware error:', error);
        res.status(500).json({ error: 'Internal server error during authentication' });
    }
};
