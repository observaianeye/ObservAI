import { describe, it, expect } from 'vitest';
import { isValidUtf8, utf8String } from '../lib/utf8Validator';

describe('utf8Validator (Yan #34 — UTF-8 zod helper)', () => {
  it('accepts well-formed Turkish/French strings', () => {
    expect(isValidUtf8('Şube')).toBe(true);
    expect(isValidUtf8('café')).toBe(true);
    expect(isValidUtf8('Giriş')).toBe(true);
    expect(isValidUtf8('Sıra')).toBe(true);
    expect(isValidUtf8('Masa 1')).toBe(true);

    // The zod refinement should also pass for these.
    const schema = utf8String(1, 100);
    expect(() => schema.parse('Şube')).not.toThrow();
    expect(() => schema.parse('café')).not.toThrow();
  });

  it('rejects strings containing the U+FFFD replacement character', () => {
    expect(isValidUtf8('Sub�e')).toBe(false);
    expect(isValidUtf8('Giri�')).toBe(false);

    const schema = utf8String(1, 100);
    expect(() => schema.parse('Sub�e')).toThrow();
  });
});
