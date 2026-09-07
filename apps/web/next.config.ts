import createNextIntlPlugin from 'next-intl/plugin';
import type { NextConfig } from 'next';

import { loadEnvFiles } from '@wikifake/env/files';

// The configuration is the first thing Next evaluates in every process it
// starts, which makes it the only place early enough to fill `process.env` from
// the workspace root. Next reads `apps/web/.env`, never the root, and
// `NEXT_PUBLIC_*` is inlined into the bundle when the compiler starts — after
// this file, before any application code. So a variable that arrives later
// arrives too late.
loadEnvFiles();

// The workspace packages are TypeScript source, not built artefacts: `exports`
// in each `package.json` points straight at `src/index.ts`. Next has to compile
// them, which is what `transpilePackages` is for — without it the app imports a
// `.ts` file it refuses to parse.
const config: NextConfig = {
  // The workspace's TypeScript sources import each other with a `.js` extension
  // — the ESM convention `verbatimModuleSyntax` asks for — and each package's
  // `exports` points straight at `src/index.ts`. So the bundler has to be told
  // that `./x.js` means `./x.ts`, or every internal import of every package
  // fails to resolve.
  //
  // This is a **webpack** option, which is why the scripts pass `--webpack`:
  // Turbopack accepts the flag as an experiment and then ignores it, and there
  // is no Turbopack equivalent (`resolveExtensions` applies to extensionless
  // requests). The durable fix is to give the packages a build step so they ship
  // real `.js` — `turbo.json` already declares `build` with `outputs: ["dist/**"]`
  // and `dependsOn: ["^build"]`, so the intent was there and phase 0 left it
  // half-done. Recorded in the debt register; it is its own piece of work,
  // because it changes what every package's tests actually exercise.
  experimental: { extensionAlias: { '.js': ['.ts', '.tsx', '.js'] } },

  // Step C.8 — the share card's two font files.
  //
  // `app/[locale]/opengraph-image.tsx` reads them with `fs.readFile` and a path
  // built at runtime, which the output tracer cannot follow: it walks imports,
  // not `join()` calls. Without this the function deploys without its fonts and
  // the card 500s — on a platform, not locally, which is the worst place to
  // find it. Named here, next to the reason.
  outputFileTracingIncludes: {
    '/[locale]/opengraph-image': ['./src/landing/fonts/*.ttf'],
    '/[locale]/opengraph-image/[__metadata_id__]': ['./src/landing/fonts/*.ttf'],
  },
  transpilePackages: [
    '@wikifake/article',
    '@wikifake/db',
    '@wikifake/domain',
    '@wikifake/env',
    '@wikifake/protocol',
    '@wikifake/ui',
  ],
};

// Points `next-intl` at the request configuration explicitly rather than
// relying on its default lookup: the path is a decision of step 11.1, and a
// moved file should fail the build loudly, not fall back.
const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

export default withNextIntl(config);
