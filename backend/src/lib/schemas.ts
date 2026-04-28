/**
 * Shared zod schemas to keep input contracts consistent across routes.
 *
 * Yan #40: cameraId zod schema diverged across routes — export.ts used
 * .uuid() but ai.ts accepted any non-empty string ('sample-camera-1' etc.).
 * Unify on UUID for any production path; ai.ts also kept its lenient option
 * but now goes through the same constant so future tightening is one edit.
 */
import { z } from 'zod';

export const CameraIdSchema = z.string().uuid({ message: 'cameraId must be UUID' });
export const CameraIdOptionalSchema = CameraIdSchema.optional();
