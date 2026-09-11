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
/** The two Archivo weights, named once for the six routes that trace them. */
const FACES = './src/brand/fonts/*.ttf';

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

  // Step C.8, and step J.2 — the font files every drawn image reads.
  //
  // `src/brand/fonts.ts` reads them with `fs.readFile` and a path built at
  // runtime, which the output tracer cannot follow: it walks imports, not
  // `join()` calls. Without this the functions deploy without their fonts and
  // 500 — on a platform, not locally, which is the worst place to find it.
  // Named here, next to the reason, one entry per route that draws.
  outputFileTracingIncludes: {
    '/[locale]/opengraph-image': [FACES],
    '/[locale]/opengraph-image/[__metadata_id__]': [FACES],
    '/icon': [FACES],
    '/icon/[__metadata_id__]': [FACES],
    '/apple-icon': [FACES],
    '/apple-icon/[__metadata_id__]': [FACES],
  },
  // Step J.2 — the one URL a favicon is still asked for by name.
  //
  // `app/icon.tsx` makes Next emit `<link rel="icon">` tags and stop serving
  // `/favicon.ico` altogether, so a client that asks for that path by
  // convention rather than by reading the document — a feed reader, a link
  // unfurler, an older browser — gets a 404. A rewrite rather than a redirect,
  // because those are the clients least likely to follow one, and the bytes
  // answered are the 32px icon: a PNG under an `.ico` name, which every one of
  // them reads.
  async rewrites() {
    return [{ source: '/favicon.ico', destination: '/icon/32' }];
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
