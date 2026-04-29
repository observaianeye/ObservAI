// Maps a backend Zod-issue array into a flat `{ fieldPath: message }` map so
// forms can render per-field errors instead of a generic "Invalid body" toast.
// Introduced in ADIM 1 (Faz 5) as the foundation for ADIM 6 staff-assignments
// 400 diagnostics — expanded to other forms as adjacent work lands.

export interface ZodIssueLike {
  path?: Array<string | number>;
  message?: string;
  code?: string;
}

export type FieldErrors = Record<string, string>;

/**
 * Collapse a Zod-style issue array into `{ "path.to.field": "message" }`.
 * Preserves the first message per path (Zod reports in traversal order, so
 * the earliest — usually the most specific — issue wins).
 */
export function parseZodIssues(issues: ZodIssueLike[] | undefined | null): FieldErrors {
  const out: FieldErrors = {};
  if (!Array.isArray(issues)) return out;
  for (const issue of issues) {
    const path = (issue.path ?? []).map((p) => String(p)).join('.') || '_';
    if (!(path in out)) {
      out[path] = issue.message ?? 'Geçersiz değer';
    }
  }
  return out;
}

/**
 * Best-effort extraction of field errors from a fetch error payload.
 * Accepts the common shapes `{ issues: [...] }` (Zod) and `{ errors: {...} }`
 * (custom backend). Returns `null` when no structured errors are present.
 */
export function extractFieldErrors(body: unknown): FieldErrors | null {
  if (!body || typeof body !== 'object') return null;
  const obj = body as Record<string, unknown>;
  if (Array.isArray(obj.issues)) {
    return parseZodIssues(obj.issues as ZodIssueLike[]);
  }
  if (obj.errors && typeof obj.errors === 'object' && !Array.isArray(obj.errors)) {
    const entries = Object.entries(obj.errors as Record<string, unknown>)
      .filter(([, v]) => typeof v === 'string') as Array<[string, string]>;
    if (!entries.length) return null;
    return Object.fromEntries(entries);
  }
  return null;
}
