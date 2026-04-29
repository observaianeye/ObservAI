/**
 * Yan #42 — Export filename includes branch+camera slug. Multi-branch SaaS
 * downloads were named identically (`analytics_export_<date>.csv`) which
 * collided in users' Downloads folder.
 */
import { describe, it, expect } from 'vitest';
import { slugifyForFilename } from '../routes/export';

describe('Yan #42 — slugifyForFilename', () => {
  it('lowercases and replaces non-alnum with underscore', () => {
    expect(slugifyForFilename('Cape Town Ekhaya')).toBe('cape_town_ekhaya');
  });

  it('strips Turkish diacritics', () => {
    expect(slugifyForFilename('Şube Beşiktaş')).toBe('sube_besiktas');
    expect(slugifyForFilename('İstanbul Çankaya')).toBe('istanbul_cankaya');
  });

  it('clamps long names to 30 chars and trims trailing underscores', () => {
    const long = 'A very long branch name with many words here exceeding cap';
    const out = slugifyForFilename(long);
    expect(out.length).toBeLessThanOrEqual(30);
    expect(out.startsWith('_')).toBe(false);
    expect(out.endsWith('_')).toBe(false);
  });

  it('falls back to "unknown" for null/undefined/empty', () => {
    expect(slugifyForFilename(null)).toBe('unknown');
    expect(slugifyForFilename(undefined)).toBe('unknown');
    expect(slugifyForFilename('')).toBe('unknown');
    expect(slugifyForFilename('!!!')).toBe('unknown');
  });
});
