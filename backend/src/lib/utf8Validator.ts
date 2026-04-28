/**
 * Yan #34: zone names showed up in the DB as "Giri�" / "S�ra" because some
 * earlier ingest path lost the original encoding and stored the replacement
 * character. Once that lands on disk we can't recover the original bytes, so
 * the only sane defense is to refuse it on the way in.
 *
 * Pure JS implementation — no external dependency. Node strings are UTF-16
 * internally, so a "valid UTF-8" string here means: encodes/decodes round
 * trip cleanly, contains no U+FFFD, and has no lone surrogate halves.
 */
import { z } from 'zod';

export function isValidUtf8(str: string): boolean {
  if (typeof str !== 'string') return false;

  // U+FFFD = baked-in replacement char from a prior bad decode.
  if (str.includes('�')) return false;

  // Lone surrogate scan: a high surrogate must be followed by a low one.
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = str.charCodeAt(i + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return false;
      i++; // skip the paired low surrogate
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      return false; // low surrogate without a leading high one
    }
  }

  // Round-trip the string through Buffer to catch any encoding pathology
  // that slipped past the surrogate scan.
  try {
    const roundTrip = Buffer.from(str, 'utf8').toString('utf8');
    if (roundTrip !== str) return false;
  } catch {
    return false;
  }

  return true;
}

/**
 * Drop-in replacement for `z.string().min(min).max(max)` that also rejects
 * strings whose UTF-8 representation is degenerate. Use it on any field that
 * gets persisted and rendered later (zone/branch/camera names, etc.).
 */
export const utf8String = (min = 1, max = 200) =>
  z
    .string()
    .min(min)
    .max(max)
    .refine(isValidUtf8, {
      message: 'Invalid UTF-8 encoding (replacement chars or invalid byte sequence)',
    });
