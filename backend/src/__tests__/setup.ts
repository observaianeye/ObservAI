/**
 * Vitest setup — runs before every test file.
 * Sets env vars that the app reads at import-time.
 */
import { vi } from 'vitest';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.DATABASE_URL ?? 'file:./test.db';
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret-do-not-use-in-prod';
process.env.SESSION_COOKIE_NAME = process.env.SESSION_COOKIE_NAME ?? 'session_token';

// Mute noisy console output unless DEBUG=1
if (process.env.DEBUG !== '1') {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'info').mockImplementation(() => {});
}
