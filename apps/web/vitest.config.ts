import { baseConfig } from '@wikifake/config/vitest';

// The route handlers live under `app/`, not `src/`: that is where Next looks for
// them, and a test beside the handler it tests is a test that gets updated with
// it.
export default {
  ...baseConfig,
  // Next's tsconfig says `jsx: preserve`, because Next compiles the JSX itself.
  // Vitest compiles with esbuild, which reads that setting and leaves the JSX
  // alone — so a rendered component fails with "React is not defined", a long
  // way from the cause.
  esbuild: { jsx: 'automatic' as const },
  test: {
    ...baseConfig.test,
    // `next-intl`'s ESM build imports `next/server` and `next/navigation`
    // without an extension, which only a bundler resolves — `next` ships no
    // `exports` map, so Node's ESM loader refuses the bare subpath. Inlined,
    // the package goes through Vite's resolver like our own sources do. Next
    // itself does the same job in production, so this changes where the
    // imports resolve, not what they resolve to.
    server: { deps: { inline: ['next-intl', 'use-intl'] } },
    // `.tsx` too, since phase 7: the client components are tested by rendering
    // them. Those files carry a `@vitest-environment jsdom` docblock — the route
    // handlers are the majority here and have no business paying for a DOM.
    include: [
      'app/**/*.test.ts',
      'app/**/*.test.tsx',
      'src/**/*.test.ts',
      'src/**/*.test.tsx',
    ],
    // One database, so one file at a time — the same reason `@wikifake/db` does
    // it. Two files truncating the same tables see each other's rows, which
    // surfaces as counts that are right for neither of them.
    fileParallelism: false,
    coverage: {
      ...baseConfig.test.coverage,
      include: ['app/**/*.ts', 'app/**/*.tsx', 'src/**/*.ts', 'src/**/*.tsx'],
    },
  },
};
