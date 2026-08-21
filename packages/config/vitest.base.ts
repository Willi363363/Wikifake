import { defineConfig } from 'vitest/config';

// Shared baseline: every package re-exports it. Coverage is measured but has
// no blocking threshold — a threshold on a repository that is just starting
// measures nothing.
export const baseConfig = defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text-summary'],
      reportsDirectory: 'coverage',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts'],
    },
  },
});
