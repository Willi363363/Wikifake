// A suite that reads the environment has to be given one.
//
// `load.ts` is imported by the four entry points that read `process.env` before
// anything else. Vitest is a fifth, and it was missed: the suites read
// `DATABASE_URL` as each file is collected and **skip themselves** when it is
// absent — which is what makes a run without a database usable, and what makes a
// run without a *file* indistinguishable from a real one. Measured on a worktree
// with a `.env.local` at its root and nothing exported: 200 cases skipped, and
// `Tasks: 9 successful, 9 total`.
//
// The rule is written over the **sources**: a package whose own code reads
// `process.env` has a suite that reads the environment, so its vitest config
// declares the setup. A package that does not — `protocol`, `domain`, `ui` —
// has nothing to load and is not asked to say so.
//
// It was first written over the dependency lists — "depends on `@wikifake/env`"
// — and that version missed `packages/article`, whose cache suites read
// `REDIS_URL` through `testing/redis.ts` and depend on this package for nothing
// else. Twenty cases went on skipping, silently, under a rule that looked
// complete. Reading what a package *does* rather than what it declares is what
// closes that, and it needs no maintenance the day somebody adds the next one.
//
// `packages/env` is the one exclusion, and it is argued rather than listed
// twice: this is where `load.ts` lives, and its own suites are precisely the
// ones that must run against an untouched `process.env`.
//
// A source assertion rather than a run, like `packages/db/src/env-loading.test.ts`:
// what is held is that a config declares something, and the text says exactly
// that.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { findWorkspaceRoot } from './files.js';

const ROOT = findWorkspaceRoot() ?? '';

/** Every workspace package directory, as `apps/web` and `packages/db` do. */
function packageDirectories(): string[] {
  return ['apps', 'packages'].flatMap((group) =>
    readdirSync(join(ROOT, group), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => join(group, entry.name)),
  );
}

/** Every `.ts`/`.tsx` file under a directory, tests included. */
function sourcesIn(directory: string): string[] {
  if (!statSync(directory, { throwIfNoEntry: false })?.isDirectory()) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : sourcesIn(path);
    return /\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

/** Whether any source in this package reads `process.env` at all. */
function readsTheEnvironment(directory: string): boolean {
  return sourcesIn(join(ROOT, directory, 'src')).some((path) =>
    /process\.env/.test(readFileSync(path, 'utf8')),
  );
}

/**
 * The packages whose suites need an environment, and this one, which must not
 * have one.
 *
 * `packages/env` is removed by name and the header says why: it is where
 * `load.ts` lives, and `files.test.ts` and `index.test.ts` assert what happens
 * when nothing has filled `process.env`. A setup file that filled it would make
 * both pass for a reason they are not about.
 */
const SELF = join('packages', 'env');

const READ_THE_ENVIRONMENT = packageDirectories().filter(
  (directory) => directory !== SELF && readsTheEnvironment(directory),
);

describe('every package that reads the environment loads it in its suites', () => {
  it('found the packages', () => {
    // Guards the guard. A workspace scan that matched nothing would make every
    // assertion below vacuous, and this is exactly the shape of failure the
    // file exists to prevent.
    expect(READ_THE_ENVIRONMENT.length).toBeGreaterThanOrEqual(4);
    // Named, because this one is the reason the rule reads sources: it depends
    // on `@wikifake/env` for nothing, and the dependency-shaped version of this
    // scan left twenty of its cases skipping.
    expect(READ_THE_ENVIRONMENT).toContain(join('packages', 'article'));
  });

  it('asks nothing of a package that never reads the environment', () => {
    // The other half. `protocol`, `domain` and `ui` have no environment to
    // load, and a rule that asked them for a setup file would be a rule
    // somebody satisfies by pasting a line nobody needs.
    for (const quiet of ['protocol', 'domain', 'ui']) {
      expect(READ_THE_ENVIRONMENT).not.toContain(join('packages', quiet));
    }
  });

  it.each(READ_THE_ENVIRONMENT)('%s declares the setup file', (directory) => {
    const config = readFileSync(join(ROOT, directory, 'vitest.config.ts'), 'utf8');

    expect(config).toContain("setupFiles: ['@wikifake/env/load']");
  });

  it('does not ask it of this package', () => {
    // Not because it reads nothing — it reads more of `process.env` than
    // anything else here — but because `files.test.ts` and `index.test.ts`
    // assert what happens when nothing has filled it.
    expect(readsTheEnvironment(SELF)).toBe(true);
    expect(READ_THE_ENVIRONMENT).not.toContain(SELF);
  });
});
