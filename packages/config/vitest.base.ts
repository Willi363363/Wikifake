// Shared baseline: every package re-exports it. Coverage is measured but has
// no blocking threshold — a threshold on a repository that is just starting
// measures nothing.
//
// Deliberately a plain object rather than `defineConfig(...)`. Wrapping it puts
// a *type* from Vitest on an export that crosses package boundaries, and pnpm is
// free to give two packages two instances of Vitest — which it did the moment
// `drizzle-kit` pulled in `tsx`, since `tsx` is a peer of Vite. The two
// instances then disagree about `UserConfigExport` and every package that
// re-exports this stops typechecking, for a reason that has nothing to do with
// its own code.
//
// Vitest reads a plain object exactly the same way, and a typo here fails
// loudly: no test is found.
export const baseConfig = {
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
};
