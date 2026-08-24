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
  article: ['ai', 'cheerio', 'domhandler', 'zod'],
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

  it('keeps protocol free of any workspace dependency', () => {
    const deps = Object.keys(manifest('protocol').dependencies ?? {});
    expect(deps.filter((name) => name.startsWith('@wikifake/'))).toEqual([]);
  });
});
