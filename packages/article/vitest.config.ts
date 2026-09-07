import { baseConfig } from '@wikifake/config/vitest';

// The cache suites talk to a real Redis and skip themselves without one.
//
// `testing/redis.ts` reads `REDIS_URL` as each file is collected, so a worktree
// with the URL in `.env.local` and nothing exported skipped twenty cases and
// reported success — the same hole `apps/web` and `packages/db` had, in the one
// package that reads the environment without depending on `@wikifake/env` for
// anything else. That is why the rule in `packages/env/src/setup-files.test.ts`
// is written over the sources rather than over the dependency lists: this
// package is what the dependency version of it missed.
export default {
  ...baseConfig,
  test: {
    ...baseConfig.test,
    setupFiles: ['@wikifake/env/load'],
  },
};
