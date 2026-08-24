// The step's other criterion: "the types are inferred through `z.infer` (no
// type redeclared by hand)".
//
// A hand-written type beside a schema is the duplication this package exists to
// remove: the two drift, and the compiler is happy while the wire is wrong. So
// every exported type in a contract file has to come from its schema, and that
// is checkable by reading the files.
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC = fileURLToPath(new URL('./', import.meta.url));

/**
 * `decode.ts` is plumbing, not a contract: `Decoded<T>` is a result type with no
 * schema behind it, and declaring it by hand is the right thing. `rest/routes.ts`
 * describes the shape of a catalogue entry rather than of a payload — there is
 * no schema behind `Route` either.
 */
const NOT_CONTRACTS = new Set(['decode.ts', 'index.ts', 'rest/routes.ts']);

function contractFiles(): string[] {
  const files: string[] = [];
  const walk = (dir: string, prefix: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        walk(`${dir}${entry.name}/`, `${prefix}${entry.name}/`);
        continue;
      }
      if (!entry.name.endsWith('.ts') || entry.name.endsWith('.test.ts')) continue;
      if (NOT_CONTRACTS.has(`${prefix}${entry.name}`)) continue;
      files.push(`${prefix}${entry.name}`);
    }
  };
  walk(SRC, '');
  return files.sort();
}

describe('contract types are inferred, never redeclared', () => {
  const files = contractFiles();

  it('found the contract files', () => {
    expect(files).toEqual([
      'article.ts',
      'errors.ts',
      'items.ts',
      'primitives.ts',
      'rest/flags.ts',
      'rest/game.ts',
      'rest/health.ts',
      'rest/rooms.ts',
      'score.ts',
      'ws/incoming.ts',
      'ws/outgoing.ts',
    ]);
  });

  it.each(files)('%s declares every exported type from a schema', (file) => {
    const source = readFileSync(`${SRC}${file}`, 'utf8');
    const declarations = [...source.matchAll(/^export type (\w+) = (.+);$/gm)];
    expect(declarations.length).toBeGreaterThan(0);

    for (const [, name, definition] of declarations) {
      expect(definition, `${file}: type ${name as string} is not inferred`).toMatch(
        /^z\.infer<typeof \w+>$/,
      );
    }
  });
});
