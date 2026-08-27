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
  test: { ...baseConfig.test, fileParallelism: false },
};
