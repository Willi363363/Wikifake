import { baseConfig } from '@wikifake/config/vitest';

// The route handlers live under `app/`, not `src/`: that is where Next looks for
// them, and a test beside the handler it tests is a test that gets updated with
// it.
export default {
  ...baseConfig,
  test: {
    ...baseConfig.test,
    include: ['app/**/*.test.ts', 'src/**/*.test.ts'],
    coverage: { ...baseConfig.test.coverage, include: ['app/**/*.ts', 'src/**/*.ts'] },
  },
};
