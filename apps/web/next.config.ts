import type { NextConfig } from 'next';

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
  transpilePackages: [
    '@wikifake/article',
    '@wikifake/db',
    '@wikifake/domain',
    '@wikifake/env',
    '@wikifake/protocol',
  ],
};

export default config;
