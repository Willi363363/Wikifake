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
// The rule below is the narrow one, and it is narrow on purpose: **a package
// that depends on `@wikifake/env` has a suite that reads the environment**, so
// its vitest config declares the setup. A package that does not — `protocol`,
// `domain`, `ui` — has nothing to load and is not asked to say so. This package
// is excluded by the same rule rather than by an exception: it cannot depend on
// itself, and its own suites are the ones that must run against an untouched
// `process.env`.
//
// A source assertion rather than a run, like `packages/db/src/env-loading.test.ts`:
// what is held is that a config declares something, and the text says exactly
// that.
import { readdirSync, readFileSync } from 'node:fs';
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

/** One manifest's dependencies, of both kinds, by name. */
function dependenciesOf(directory: string): string[] {
  const manifest = JSON.parse(
    readFileSync(join(ROOT, directory, 'package.json'), 'utf8'),
  ) as Record<string, Record<string, string> | undefined>;

  return [
    ...Object.keys(manifest['dependencies'] ?? {}),
    ...Object.keys(manifest['devDependencies'] ?? {}),
  ];
}

/**
 * The packages that depend on this one, and therefore read the environment.
 *
 * Read out of the dependency lists rather than out of the file: this package's
 * own manifest carries the string `"@wikifake/env"` as its **name**, and a
 * substring search puts it in its own list — which is the one place the rule
 * must not reach.
 */
const READ_THE_ENVIRONMENT = packageDirectories().filter((directory) =>
  dependenciesOf(directory).includes('@wikifake/env'),
);

describe('every package that reads the environment loads it in its suites', () => {
  it('found the packages', () => {
    // Guards the guard. A workspace scan that matched nothing would make every
    // assertion below vacuous, and this is exactly the shape of failure the
    // file exists to prevent.
    expect(READ_THE_ENVIRONMENT.length).toBeGreaterThanOrEqual(3);
  });

  it.each(READ_THE_ENVIRONMENT)('%s declares the setup file', (directory) => {
    const config = readFileSync(join(ROOT, directory, 'vitest.config.ts'), 'utf8');

    expect(config).toContain("setupFiles: ['@wikifake/env/load']");
  });

  it('does not ask it of this package', () => {
    // `files.test.ts` and `index.test.ts` assert what happens when nothing has
    // filled `process.env`. A setup file that filled it would make both pass
    // for a reason they are not about.
    expect(READ_THE_ENVIRONMENT).not.toContain(join('packages', 'env'));
  });
});
