/**
 * Tenant-scope ownership helpers.
 *
 * Pattern: every tenant-scoped route mounts `authenticate` first to populate
 * `req.user`, then either (a) filters its Prisma query by `req.user.id` or
 * (b) chains a `requireXxxOwnership(:idParam)` middleware that 404s when the
 * resource doesn't belong to the caller.
 *
 * Returning 404 (not 403) on ownership failure is intentional — leaking
 * "this id exists, you just can't see it" is itself a tenant-scope leak.
 */

import { Response, NextFunction } from 'express';
import { prisma } from '../lib/db';
import { AuthenticatedRequest } from './roleCheck';

export async function userOwnsCamera(userId: string, cameraId: string): Promise<boolean> {
  const cam = await prisma.camera.findFirst({
    where: { id: cameraId, createdBy: userId },
    select: { id: true },
  });
  return !!cam;
}

export async function userOwnsZone(userId: string, zoneId: string): Promise<boolean> {
  const z = await prisma.zone.findFirst({
    where: { id: zoneId, camera: { createdBy: userId } },
    select: { id: true },
  });
  return !!z;
}

export async function userOwnsBranch(userId: string, branchId: string): Promise<boolean> {
  const b = await prisma.branch.findFirst({
    where: { id: branchId, userId },
    select: { id: true },
  });
  return !!b;
}

export async function userOwnsStaff(userId: string, staffId: string): Promise<boolean> {
  const s = await prisma.staff.findFirst({
    where: { id: staffId, userId },
    select: { id: true },
  });
  return !!s;
}

function ownershipMiddleware(
  resourceLabel: string,
  idParam: string,
  check: (userId: string, id: string) => Promise<boolean>
) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userId = req.user?.id;
    const id = req.params[idParam];
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    if (!id) return res.status(400).json({ error: `Missing ${idParam}` });
    if (!(await check(userId, id))) {
      return res.status(404).json({ error: `${resourceLabel} not found` });
    }
    next();
  };
}

export const requireCameraOwnership = (idParam = 'id') =>
  ownershipMiddleware('Camera', idParam, userOwnsCamera);

export const requireZoneOwnership = (idParam = 'id') =>
  ownershipMiddleware('Zone', idParam, userOwnsZone);

export const requireBranchOwnership = (idParam = 'id') =>
  ownershipMiddleware('Branch', idParam, userOwnsBranch);

export const requireStaffOwnership = (idParam = 'id') =>
  ownershipMiddleware('Staff', idParam, userOwnsStaff);
