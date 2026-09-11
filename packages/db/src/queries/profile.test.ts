// The pseudonym, and the rule that no two accounts hold one — step E.3.1,
// against a real Postgres.
//
// The suite turns on one property: **the database decides, not the process.**
// Every refusal below is a unique constraint answering, and the case that
// matters most is the last one — two claims for the same name issued before
// either has committed, which no read-then-insert could refuse.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { claimPseudonym, selectPseudonym } from './profile.js';
import { user } from '../schema/auth.js';
import { profile } from '../schema/profile.js';
import { openTestDatabase, rejectionCode, testDatabaseUrl } from '../testing/database.js';
import type { TestDatabase } from '../testing/database.js';

const url = testDatabaseUrl();

describe.skipIf(url === null)('E.3.1 — the pseudonym is unique', () => {
  let store: TestDatabase;

  beforeAll(async () => {
    store = await openTestDatabase(url as string);
  });

  beforeEach(async () => {
    await store.truncate();
  });

  afterAll(async () => {
    await store.close();
  });

  /** An account to hang a pseudonym off. Better Auth would create these. */
  const addUser = async (id: string): Promise<void> => {
    await store.db
      .insert(user)
      .values({ id, name: id, email: `${id}@example.test`, emailVerified: false });
  };

  it('gives an account the pseudonym it asked for', async () => {
    await addUser('u1');

    const claim = await claimPseudonym(store.db, 'u1', 'Ada');

    expect(claim).toEqual({
      ok: true,
      pseudonym: { displayName: 'Ada', displayNameKey: 'ada' },
    });
  });

  it('stores the capitals their owner typed, and keys the folded form', async () => {
    await addUser('u1');
    await claimPseudonym(store.db, 'u1', 'Ada  Lovelace');

    const rows = await store.db.select().from(profile);

    // The pseudonym a room shows is the one that was typed; the pseudonym the
    // constraint compares is the fold. Both, from one statement.
    expect(rows[0]?.displayName).toBe('Ada  Lovelace');
    expect(rows[0]?.displayNameKey).toBe('ada lovelace');
  });

  it.each([
    ['the same name', 'Ada Lovelace'],
    ['a different casing', 'ADA LOVELACE'],
    ['surrounding space', '  Ada Lovelace  '],
    ['a doubled space inside it', 'Ada  Lovelace'],
  ])('refuses %s once somebody holds it', async (_what, wanted) => {
    await addUser('u1');
    await addUser('u2');
    await claimPseudonym(store.db, 'u1', 'Ada Lovelace');

    const second = await claimPseudonym(store.db, 'u2', wanted);

    // A refusal, not a throw: "that pseudonym is taken" is a sentence a player
    // can act on, and a caller should not have to know a SQLSTATE to say it.
    expect(second).toEqual({ ok: false, reason: 'taken' });
  });

  it('leaves the holder alone when a claim is refused', async () => {
    await addUser('u1');
    await addUser('u2');
    await claimPseudonym(store.db, 'u1', 'Ada');

    await claimPseudonym(store.db, 'u2', 'ADA');

    // The loser of a collision gets nothing, and the winner keeps what they
    // typed. An upsert here would silently hand one player's name to another.
    expect(await selectPseudonym(store.db, 'u1')).toEqual({
      displayName: 'Ada',
      displayNameKey: 'ada',
    });
    expect(await selectPseudonym(store.db, 'u2')).toBeNull();
  });

  it('refuses the other encoding of the same accented name', async () => {
    await addUser('u1');
    await addUser('u2');
    await claimPseudonym(store.db, 'u1', 'Élise');

    // `E` plus a combining acute, which is one glyph on screen and would be a
    // second `Élise` in a room. The fold is applied before the constraint sees
    // either, so the database compares two identical strings.
    const second = await claimPseudonym(store.db, 'u2', 'E\u0301lise');

    expect(second).toEqual({ ok: false, reason: 'taken' });
  });

  it('lets two accounts hold pseudonyms that only look similar', async () => {
    await addUser('u1');
    await addUser('u2');

    expect((await claimPseudonym(store.db, 'u1', 'jean-luc')).ok).toBe(true);
    expect((await claimPseudonym(store.db, 'u2', 'jean_luc')).ok).toBe(true);
  });

  it('answers null for an account that has not chosen one', async () => {
    await addUser('u1');

    // Not an error. An account that arrived through Google has no profile row
    // until somebody picks a name for it, and E.3.2 is the screen that asks.
    expect(await selectPseudonym(store.db, 'u1')).toBeNull();
  });

  it('refuses a second pseudonym for an account that already has one', async () => {
    await addUser('u1');
    await claimPseudonym(store.db, 'u1', 'ada');

    // `userId` is the primary key, so this is the same unique violation and it
    // comes back the same way. A claim creates a pseudonym; it never renames.
    expect(await claimPseudonym(store.db, 'u1', 'bob')).toEqual({
      ok: false,
      reason: 'taken',
    });
  });

  it('still throws for a failure a player cannot retype their way out of', async () => {
    // No `user` row: a foreign key violation, which is a bug in the caller and
    // not a taken name. Turning it into a refusal would show somebody "that
    // pseudonym is taken" for an account that does not exist.
    await expect(claimPseudonym(store.db, 'nobody', 'ada')).rejects.toThrow();
  });

  it('refuses the loser of a race neither claim could have seen coming', async () => {
    await addUser('u1');
    await addUser('u2');

    // Both issued before either has committed, which is exactly the case a
    // read-then-insert cannot refuse: both reads would have said *free*.
    const [first, second] = await Promise.allSettled([
      claimPseudonym(store.db, 'u1', 'Ada'),
      claimPseudonym(store.db, 'u2', 'ada'),
    ]);

    const outcomes = [first, second].map((settled) =>
      settled.status === 'fulfilled' ? settled.value : { ok: false, reason: 'threw' },
    );

    expect(outcomes.filter((outcome) => outcome.ok)).toHaveLength(1);
    expect(outcomes.filter((outcome) => !outcome.ok)).toEqual([
      { ok: false, reason: 'taken' },
    ]);
  });

  it('is the constraint that refuses, not the query that wrote it', async () => {
    await addUser('u1');
    await addUser('u2');
    await claimPseudonym(store.db, 'u1', 'ada');

    // Written past `claimPseudonym`, so the guarantee is the schema's rather
    // than one function's care. Anything reaching this table is held to it.
    const code = await rejectionCode(
      store.db
        .insert(profile)
        .values({ userId: 'u2', displayName: 'Somebody Else', displayNameKey: 'ada' }),
    );

    expect(code).toBe('23505');
  });
});
