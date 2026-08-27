import { baseConfig } from '@wikifake/config/vitest';

// The primitives are rendered, not inspected. A render test against a real DOM
// is what can answer the only questions worth asking of them — is this focusable,
// does Escape close it, does the label point at the input — and none of those
// can be answered by reading a component.
export default {
  ...baseConfig,
  test: {
    ...baseConfig.test,
    environment: 'jsdom',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    coverage: {
      ...baseConfig.test.coverage,
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      exclude: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    },
  },
};
