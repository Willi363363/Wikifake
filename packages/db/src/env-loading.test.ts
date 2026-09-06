// The package's two commands read the environment before anything fills it.
//
// `drizzle-kit migrate` and `tsx scripts/seed.ts` both call
// `requireDatabaseUrl()` while their module is being evaluated, and Turborepo
// runs them from this directory — so neither sees the repository root unless
// `@wikifake/env/load` walks up to it first. Without that import `pnpm migrate`
// failed with `DATABASE_URL is not set` against a `.env.local` that was there
// all along, which reads as a broken file rather than a missing import.
//
// A source assertion rather than a run: executing either command needs a
// Postgres, and what is being held here is the order of two imports, which the
// text states exactly. `turbo-env.test.ts` guards the other half of the same
// failure.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const PACKAGE = fileURLToPath(new URL('../', import.meta.url));

const ENTRY_POINTS = ['drizzle.config.ts', 'scripts/seed.ts'] as const;

/** The module specifiers a file imports, in the order it imports them. */
function imports(file: string): string[] {
  const source = readFileSync(`${PACKAGE}${file}`, 'utf8');
  return [...source.matchAll(/^import\s(?:.*?\sfrom\s)?'([^']+)';$/gm)].map(
    (match) => match[1]!,
  );
}

describe.each(ENTRY_POINTS)('%s', (file) => {
  it('loads the workspace environment', () => {
    expect(imports(file)).toContain('@wikifake/env/load');
  });

  it('loads it before anything else', () => {
    // Not cosmetic: ESM evaluates every import of a module before that module's
    // first statement, so an import placed second runs after the one above it
    // has already read an empty `process.env`.
    expect(imports(file)[0]).toBe('@wikifake/env/load');
  });
});
