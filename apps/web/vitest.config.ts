import { baseConfig } from '@wikifake/config/vitest';

// The route handlers live under `app/`, not `src/`: that is where Next looks for
// them, and a test beside the handler it tests is a test that gets updated with
// it.
export default {
  ...baseConfig,
  test: {
    ...baseConfig.test,
    include: ['app/**/*.test.ts', 'src/**/*.test.ts'],
    // One database, so one file at a time — the same reason `@wikifake/db` does
    // it. Two files truncating the same tables see each other's rows, which
    // surfaces as counts that are right for neither of them.
    fileParallelism: false,
    coverage: { ...baseConfig.test.coverage, include: ['app/**/*.ts', 'src/**/*.ts'] },
  },
};
