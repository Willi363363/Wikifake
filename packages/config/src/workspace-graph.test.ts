// The dependency graph is a decision, not an accident.
//
// `protocol` is the single source of the contracts and `domain` the rules: if
// either one grows a dependency on a database driver, a WebSocket library or a
// clock, the rules stop being testable without them — which is the entire
// reason those two packages exist (plans/rewrite/00-overview.md, "the two
// packages marked ★"). Adding a dependency to one of them fails here, and the
// pull request has to justify it.
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const PACKAGES = fileURLToPath(new URL('../../', import.meta.url));

interface Manifest {
  readonly name: string;
  readonly dependencies?: Readonly<Record<string, string>>;
}

function manifest(pkg: string): Manifest {
  return JSON.parse(readFileSync(`${PACKAGES}${pkg}/package.json`, 'utf8')) as Manifest;
}

// Runtime dependencies only: a test runner or a linter is tooling, and the
// packages are free to grow those.
const EXPECTED: Readonly<Record<string, readonly string[]>> = {
  config: [],
  env: ['zod'],
  protocol: ['zod'],
  domain: ['@wikifake/protocol'],
  db: ['@wikifake/env', '@wikifake/protocol', 'drizzle-orm', 'postgres'],
  article: ['@wikifake/protocol', 'ai', 'cheerio', 'domhandler', 'zod'],
  // The design system ships a stylesheet and the lists that describe it. No
  // runtime dependency at all, and that is the interesting part: a theme that
  // needed a framework to be read would be a theme no test could check against
  // the one it transcribes.
  ui: [],
};

describe('workspace dependency graph', () => {
  it('has exactly the declared packages', () => {
    const found = readdirSync(PACKAGES, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
    expect(found).toEqual(Object.keys(EXPECTED).sort());
  });

  it.each(Object.entries(EXPECTED))('%s depends on exactly %j', (pkg, expected) => {
    expect(Object.keys(manifest(pkg).dependencies ?? {}).sort()).toEqual(
      [...expected].sort(),
    );
  });

  it('names every package under the @wikifake scope', () => {
    for (const pkg of Object.keys(EXPECTED)) {
      expect(manifest(pkg).name).toBe(`@wikifake/${pkg}`);
    }
  });

  // `domain` holds the rules and `protocol` the contracts: the rules import the
  // contracts, never the other way round. A cycle here would mean the contract
  // has started depending on the rule it describes.
  // `db` may import the contracts — the schema is built on them rather than
  // redeclaring the shapes — but never the rules. Data does not depend on rules.
  it('keeps db away from domain', () => {
    expect(Object.keys(manifest('db').dependencies ?? {})).not.toContain(
      '@wikifake/domain',
    );
  });

  // `article` produces the contracts, so it imports them. It does not import the
  // rules either — its end-to-end test asks `domain` whether the solution it
  // built is well formed, and that is a test dependency, not a runtime one.
  it('keeps article away from domain at runtime', () => {
    expect(Object.keys(manifest('article').dependencies ?? {})).not.toContain(
      '@wikifake/domain',
    );
  });

  // `db` reads `article` in one integration test — the one that proves a
  // generation's call records fit the `llm_call` table. That is a test
  // dependency, and it must stay one: the data flows from the generator into the
  // schema, and a runtime edge here would make the persistence layer depend on
  // the thing it persists.
  it('lets db read article in tests, never at runtime', () => {
    const manifestOfDb = manifest('db') as Manifest & {
      devDependencies?: Readonly<Record<string, string>>;
    };
    expect(Object.keys(manifestOfDb.dependencies ?? {})).not.toContain(
      '@wikifake/article',
    );
    expect(Object.keys(manifestOfDb.devDependencies ?? {})).toContain(
      '@wikifake/article',
    );
  });

  // The applications are leaves. They may import every package — that is what an
  // application is for — but nothing may import one back: a package that depends
  // on the app can no longer be tested without Next, React and a bundler, which
  // is the whole reason the rules live outside it.
  //
  // The two apps must not import each other either. They are deployed to two
  // different platforms — the web on Vercel, the realtime service on Fly — so an
  // edge between them is a build that only works where both happen to be
  // present, and the failure surfaces at deploy time.
  const APPS = ['web', 'realtime'] as const;

  it.each(APPS)('declares apps/%s under the @wikifake scope', (app) => {
    const found = JSON.parse(
      readFileSync(`${PACKAGES}../apps/${app}/package.json`, 'utf8'),
    ) as Manifest;
    expect(found.name).toBe(`@wikifake/${app}`);
  });

  it.each(APPS)('keeps apps/%s a leaf', (app) => {
    for (const pkg of Object.keys(EXPECTED)) {
      const manifestOf = manifest(pkg) as Manifest & {
        devDependencies?: Readonly<Record<string, string>>;
      };
      const every = [
        ...Object.keys(manifestOf.dependencies ?? {}),
        ...Object.keys(manifestOf.devDependencies ?? {}),
      ];
      expect(every).not.toContain(`@wikifake/${app}`);
    }

    for (const other of APPS.filter((name) => name !== app)) {
      const manifestOf = JSON.parse(
        readFileSync(`${PACKAGES}../apps/${other}/package.json`, 'utf8'),
      ) as Manifest & { devDependencies?: Readonly<Record<string, string>> };
      const every = [
        ...Object.keys(manifestOf.dependencies ?? {}),
        ...Object.keys(manifestOf.devDependencies ?? {}),
      ];
      expect(every).not.toContain(`@wikifake/${app}`);
    }
  });

  it('keeps protocol free of any workspace dependency', () => {
    const deps = Object.keys(manifest('protocol').dependencies ?? {});
    expect(deps.filter((name) => name.startsWith('@wikifake/'))).toEqual([]);
  });
});
