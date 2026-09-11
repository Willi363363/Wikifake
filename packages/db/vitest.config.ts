import { baseConfig } from '@wikifake/config/vitest';

// One database, so one file at a time.
//
// Vitest runs test files in parallel by default, and two files truncating the
// same tables deadlock on each other — which surfaced as a one-second hang and
// then a failure in whichever file lost. Giving each file its own database would
// be the alternative; running them in series costs a second and needs no
// orchestration.
export default {
  ...baseConfig,
  test: {
    ...baseConfig.test,
    fileParallelism: false,
    // `testDatabaseUrl()` reads `DATABASE_URL` as each file is collected and
    // returns null when it is absent, which skips the integration suites and
    // still exits 0. `drizzle.config.ts` and `scripts/seed.ts` gained this
    // import at #177; the suites are the third command run from this directory
    // and they had the same hole.
    setupFiles: ['@wikifake/env/load'],
  },
};
