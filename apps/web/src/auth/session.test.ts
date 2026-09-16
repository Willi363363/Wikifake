// Step O.6 — the session is read once a request, and that is a rule.
//
// **A count, never a stopwatch.** A timing assertion measures the runner, which
// is the argument `10-test-debt.md` makes about `until` and C.7 makes about
// frame budgets — and nothing here is about how fast Postgres answered. What is
// asserted is *how many times the question was asked*, which is the whole of
// what step O.6 changed.
//
// The rule is held the way `admin/gate.test.ts` holds its own: by reading the
// sources. A page that calls `getSession` itself is not wrong in any way a type
// can see, and it puts back exactly the duplication this step measured away —
// six `session` and `user` reads on one load of `/fr/profile`, because three
// callers each asked. So the gate is not "remember to use `currentSession`", it
// is a case that fails when somebody does not.
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const HERE = fileURLToPath(new URL('./', import.meta.url));

/**
 * Every server source that could ask who is asking, by its own headers.
 *
 * The route handlers are deliberately **not** here. They take the request as an
 * argument and read `request.headers`, which is a different question with a
 * different answer — one request, one handler, no render pass to share — and
 * `cache` would buy them nothing.
 */
function serverSources(): { name: string; path: string }[] {
  const found: { name: string; path: string }[] = [];

  const walk = (dir: string, prefix: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules') continue;
      if (entry.isDirectory()) {
        walk(`${dir}${entry.name}/`, `${prefix}${entry.name}/`);
        continue;
      }
      if (entry.name.endsWith('.test.ts') || entry.name.endsWith('.test.tsx')) continue;
      if (!entry.name.endsWith('.ts') && !entry.name.endsWith('.tsx')) continue;
      // The memo itself is the one caller allowed to ask.
      if (`${prefix}${entry.name}` === 'src/auth/session.ts') continue;
      found.push({ name: `${prefix}${entry.name}`, path: `${dir}${entry.name}` });
    }
  };

  walk(`${HERE}../../app/`, 'app/');
  walk(`${HERE}../account/`, 'src/account/');
  walk(`${HERE}../admin/`, 'src/admin/');
  walk(HERE, 'src/auth/');
  return found.sort((a, b) => a.name.localeCompare(b.name));
}

/** What a caller that reads the request's own headers looks like. */
const BY_HEADERS = /getSession\(\s*\{\s*headers:\s*await headers\(\)/u;

describe('O.6 — who is asking, asked once', () => {
  it('found the sources, so the rule below is not vacuous', () => {
    const names = serverSources().map((source) => source.name);
    expect(names).toContain('app/[locale]/profile/page.tsx');
    expect(names).toContain('src/account/gate.ts');
    expect(names).toContain('src/admin/gate.ts');
  });

  it.each(serverSources())(
    '$name does not ask for the session itself',
    ({ path, name }) => {
      expect(
        BY_HEADERS.test(readFileSync(path, 'utf8')),
        `${name} reads the session by its own headers; go through currentSession() ` +
          'so the layout, the page and the viewer share one answer (step O.6)',
      ).toBe(false);
    },
  );

  it('is the only place that reads the session from the request headers', () => {
    const source = readFileSync(`${HERE}session.ts`, 'utf8');

    // The memo itself, and it is a memo: `cache` from React, not a module-level
    // variable. Two requests must never share an answer, which is the bug a
    // variable here would be and the reason this file exists at all.
    expect(source).toContain("import { cache } from 'react'");
    expect(BY_HEADERS.test(source)).toBe(true);
  });
});
