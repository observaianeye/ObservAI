/**
 * Role-based access control middleware
 * Enforces role restrictions on API routes
 */

import { Request, Response, NextFunction } from 'express';
// import { UserRole } from '@prisma/client'; // Removed due to SQLite limitation

type UserRole = 'ADMIN' | 'MANAGER' | 'ANALYST' | 'VIEWER';

/**
 * Interface for request with user info
 * Note: In production, this would come from JWT/session authentication
 */
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string; // Changed to string
  };
}

/**
 * Role hierarchy for permission checking
 * Higher index = more permissions
 */
/**
 * Role hierarchy for permission checking
 * Higher index = more permissions
 */
const ROLE_HIERARCHY: string[] = [
  'VIEWER',    // Lowest - View-only access (legacy)
  'ANALYST',   // Read-only access (GET requests only)
  'MANAGER',   // Can manage cameras and zones
  'ADMIN'      // Highest - Full access
];

/**
 * Get role level (higher = more permissions)
 */
function getRoleLevel(role: string): number {
  return ROLE_HIERARCHY.indexOf(role);
}

/**
 * Check if user has required role or higher
 */
export function hasRole(userRole: string, requiredRole: string): boolean {
  return getRoleLevel(userRole) >= getRoleLevel(requiredRole);
}

/**
 * Middleware: Require specific role or higher
 * @param minRole Minimum required role
 */
export function requireRole(minRole: UserRole) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    // For now, we'll allow all requests if no user is attached
    // In production, you'd reject unauthenticated requests
    if (!req.user) {
      console.warn('⚠️  No user attached to request - skipping role check (dev mode)');
      return next();
    }

    if (!hasRole(req.user.role, minRole)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `This action requires ${minRole} role or higher`,
        yourRole: req.user.role
      });
    }

    next();
  };
}

/**
 * Middleware: Read-only enforcement for ANALYST and VIEWER roles
 * Allows GET/HEAD/OPTIONS, blocks POST/PUT/PATCH/DELETE
 */
export function enforceReadOnly(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  // Skip check if no user attached (dev mode)
  if (!req.user) {
    return next();
  }

  // Check if user has read-only role
  const isReadOnly = req.user.role === 'ANALYST' || req.user.role === 'VIEWER';

  if (isReadOnly) {
    // Allow safe methods
    const safeMethods = ['GET', 'HEAD', 'OPTIONS'];

    if (!safeMethods.includes(req.method)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `${req.user.role} role can only perform read operations (GET requests)`,
        yourRole: req.user.role,
        method: req.method
      });
    }
  }

  next();
}

/**
 * Middleware: Admin only
 */
export const requireAdmin = requireRole('ADMIN');

/**
 * Middleware: Manager or higher (MANAGER, ADMIN)
 */
export const requireManager = requireRole('MANAGER');

/**
 * Middleware: Analyst or higher (ANALYST, MANAGER, ADMIN)
 */
export const requireAnalyst = requireRole('ANALYST');

/**
 * Demo middleware: Attach mock user for testing
 * In production, replace with JWT/session authentication
 */
export function attachMockUser(role: UserRole = 'ANALYST') {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    req.user = {
      id: 'demo-user-id',
      email: `demo-${role.toLowerCase()}@observai.com`,
      role: role
    };
    next();
  };
}
