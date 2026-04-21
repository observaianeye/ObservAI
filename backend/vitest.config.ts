import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/__tests__/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
    testTimeout: 10000,
    hookTimeout: 10000,
    // Sequential for test DB safety
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: true,
      },
    },
    setupFiles: ['src/__tests__/setup.ts'],
  },
});
