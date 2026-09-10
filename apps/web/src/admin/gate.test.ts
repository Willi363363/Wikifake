// Who reaches the panel — step I.1, against a real Postgres.
//
// The step's whole content is *who gets in*, so this is the suite that matters
// more than any figure the sections will later show: a dashboard with the wrong
// answer here is a dashboard that shows the game's numbers to strangers.
//
// **404 and not 403**, for everybody who is not an admin. The cases below check
// each way of not being one, and the last two check the rule rather than an
// instance: that every page under `admin/` calls the gate, and that nothing in
// the panel writes.
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { admin, isAdmin, user } from '@wikifake/db';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { openWebTestDatabase, webTestDatabaseUrl } from '../testing/database.js';
import { rejectionCode, SQLSTATE } from '@wikifake/db/testing';
import type { TestDatabase } from '@wikifake/db/testing';

const url = webTestDatabaseUrl();

describe.skipIf(url === null)('I.1 — the admin read', () => {
  let store: TestDatabase;

  beforeAll(async () => {
    store = await openWebTestDatabase();
  });

  beforeEach(async () => {
    await store.truncate();
  });

  afterAll(async () => {
    await store.close();
  });

  const addUser = (id: string) =>
    store.db
      .insert(user)
      .values({ id, name: id, email: `${id}@example.test`, emailVerified: false });

  it('says no for an account that was never granted it', async () => {
    await addUser('ada');

    expect(await isAdmin(store.db, 'ada')).toBe(false);
  });

  it('says yes for one that was', async () => {
    await addUser('ada');
    await store.db.insert(admin).values({ userId: 'ada' });

    expect(await isAdmin(store.db, 'ada')).toBe(true);
  });

  it('says no for an account that does not exist', async () => {
    // Not an error. The caller is a route deciding whether to answer 404, and
    // "there is nobody here" and "this is not an admin" deserve one answer.
    expect(await isAdmin(store.db, 'nobody')).toBe(false);
  });

  it('cannot hold the same account twice', async () => {
    // `user_id` is the primary key, because *this account is an admin* is a
    // fact that can only be true once.
    await addUser('ada');
    await store.db.insert(admin).values({ userId: 'ada' });

    // The SQLSTATE, not the message: `postgres.js` reports "Failed query: …"
    // and keeps the class in a property, so matching text would pass for a typo.
    expect(await rejectionCode(store.db.insert(admin).values({ userId: 'ada' }))).toBe(
      SQLSTATE.uniqueViolation,
    );
  });

  it('refuses a grant to an account that does not exist', async () => {
    expect(await rejectionCode(store.db.insert(admin).values({ userId: 'nobody' }))).toBe(
      SQLSTATE.foreignKeyViolation,
    );
  });

  it('loses the grant when the account is deleted', async () => {
    // `on delete cascade`: a privileged row pointing at nobody is a row nobody
    // can audit, and E.7's erasure must not leave one behind.
    await addUser('ada');
    await store.db.insert(admin).values({ userId: 'ada' });

    await store.db.delete(user);

    const rows = await store.db.select({ userId: admin.userId }).from(admin);
    expect(rows).toEqual([]);
  });

  it('records when it was granted, without being asked', async () => {
    await addUser('ada');
    await store.db.insert(admin).values({ userId: 'ada' });

    const [row] = await store.db
      .select({ grantedAt: admin.grantedAt, note: admin.note })
      .from(admin);
    expect(row?.grantedAt).toBeInstanceOf(Date);
    // Nullable, so the one-line grant statement in `schema/admin.ts` works.
    expect(row?.note).toBeNull();
  });

  it('arrives empty, which is the safe default', async () => {
    // No admins means the route answers 404 to everybody, including whoever
    // deployed it. A panel that let its first visitor in would have no access
    // control at all for as long as nobody noticed.
    const rows = await store.db.select({ userId: admin.userId }).from(admin);
    expect(rows).toEqual([]);
  });
});

describe('I.1 — the gate is a rule, not a habit', () => {
  const HERE = fileURLToPath(new URL('./', import.meta.url));
  const ROUTES = `${HERE}../../app/[locale]/admin/`;

  function pages(): string[] {
    const found: string[] = [];
    const walk = (dir: string, prefix: string): void => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.isDirectory()) {
          walk(`${dir}${entry.name}/`, `${prefix}${entry.name}/`);
          continue;
        }
        if (entry.name === 'page.tsx' || entry.name === 'route.ts') {
          found.push(`${prefix}${entry.name}`);
        }
      }
    };
    walk(ROUTES, '');
    return found.sort();
  }

  it('found the pages, so the rule below is not vacuous', () => {
    expect(pages()).toContain('page.tsx');
  });

  it.each(pages())('%s awaits requireAdmin', (page) => {
    // A gate some pages remembered to call is a gate; one they all call is a
    // rule. I.2 to I.7 add six sections, and this is what makes forgetting on
    // the seventh a failing test rather than a leak.
    //
    // **The call and not the name**, which a mutation found: deleting
    // `await requireAdmin();` and leaving the import passed the first version
    // of this test. A page that imports a gate is a page that does not use it.
    const source = readFileSync(`${ROUTES}${page}`, 'utf8');

    expect(source).toMatch(/await requireAdmin\(\)/);
  });

  it.each(pages())('%s sends nobody anywhere', (page) => {
    // No redirect anywhere in the panel. Every other gated page in this
    // application redirects, and each redirect is an answer: *this page exists
    // and you are not on it yet*. Here that answer is the thing being withheld.
    const source = readFileSync(`${ROUTES}${page}`, 'utf8');

    expect(source).not.toMatch(/\bredirect\(/);
  });
});

describe('I.1 — the panel writes nothing', () => {
  const HERE = fileURLToPath(new URL('./', import.meta.url));

  /** Track I's exit gate: no write, no mutation, no destructive action. */
  const FORBIDDEN = [
    /\.insert\(/,
    /\.update\(/,
    /\.delete\(/,
    /\bmethod:\s*'POST'/,
    /\brecordMovement\b/,
    /\bsetWorn/,
  ] as const;

  function sources(): string[] {
    return readdirSync(HERE)
      .filter((name) => name.endsWith('.ts') || name.endsWith('.tsx'))
      .filter((name) => !name.endsWith('.test.ts') && !name.endsWith('.test.tsx'))
      .sort();
  }

  it('found the sources', () => {
    expect(sources()).toContain('gate.ts');
  });

  it.each(FORBIDDEN)('nothing under src/admin matches %s', (pattern) => {
    // Read as text, the way `purity.test.ts` reads `domain`: the exit gate says
    // "no write anywhere in the diff", and a promise in a document is a promise
    // the sixth section breaks.
    for (const name of sources()) {
      const source = readFileSync(`${HERE}${name}`, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .split('\n')
        .filter((line) => !line.trimStart().startsWith('//'))
        .join('\n');

      expect(source, `${name} writes`).not.toMatch(pattern);
    }
  });
});
