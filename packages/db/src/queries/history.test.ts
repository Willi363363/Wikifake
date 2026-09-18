// 4.3's data half: what an account has played, and moving a guest's play onto it.
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { attachGuestRecords, HISTORY_QUERIES, selectGameHistory } from './history.js';
import { flagReport } from '../schema/audit.js';
import { game, participant } from '../schema/game.js';
import { user } from '../schema/auth.js';
import {
  openTestDatabase,
  rejectionCode,
  SQLSTATE,
  testDatabaseUrl,
} from '../testing/database.js';
import type { TestDatabase } from '../testing/database.js';

/**
 * The streak rule, as production passes it.
 *
 * `db` may not import `@wikifake/domain` — `workspace-graph.test.ts` says data
 * does not depend on rules — so its suites cannot either. This is
 * `isPerfectRound` written out, and `stats.test.ts` is where the behaviour it
 * describes is asserted.
 */
const perfectRound = (round: {
  readonly truePositives: number;
  readonly falsePositives: number;
  readonly totalFakes: number;
}): boolean =>
  round.falsePositives === 0 &&
  round.totalFakes > 0 &&
  round.truePositives === round.totalFakes;

const url = testDatabaseUrl();

describe.skipIf(url === null)('a guest, and the account that comes after', () => {
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

  // C1.1 and C1.2 — a history list and a debrief look alike, and one of them is
  // about games somebody else may still be playing. Checked on the SQL the query
  // will actually send, so it holds for rows that do not exist yet.
  describe('never mention the solution', () => {
    it.each(HISTORY_QUERIES.map((query) => [query.name, query] as const))(
      '%s',
      (_name, query) => {
        const { sql } = query(store.db, 'a-user-id').toSQL();
        expect(sql).not.toContain('game_position');
        expect(sql).not.toContain('explanation');
        expect(sql).not.toContain('hint');
        expect(sql).not.toContain('original_text');
      },
    );
  });

  const addUser = async (id: string, name: string, anonymous: boolean): Promise<void> => {
    await store.db.insert(user).values({
      id,
      name,
      email: `${id}@example.test`,
      isAnonymous: anonymous,
    });
  };

  const addGame = async (topic: string): Promise<string> => {
    const [row] = await store.db
      .insert(game)
      .values({
        mode: 'solo',
        topic,
        sourceUrl: `https://fr.wikipedia.org/wiki/${topic}`,
        paragraphs: ['un paragraphe'],
        totalFakes: 2,
        timeLimit: 300,
      })
      .returning({ id: game.id });
    if (row === undefined) throw new Error('no game');
    return row.id;
  };

  it('lets a participant carry both an identity and a chosen name', async () => {
    // The case phase 2's "exactly one" check forbade, and which is the normal one
    // for a guest: an anonymous row for identity, a nickname for this game.
    await addUser('guest-1', 'Anonymous', true);
    const gameId = await addGame('Chocolat');

    await store.db.insert(participant).values({
      gameId,
      userId: 'guest-1',
      guestName: 'Élise',
      colour: '#ff0000',
    });

    const [row] = await store.db.select().from(participant);
    expect(row?.userId).toBe('guest-1');
    expect(row?.guestName).toBe('Élise');
  });

  it('still refuses a participant that is neither', async () => {
    const gameId = await addGame('Chat');
    const code = await rejectionCode(
      store.db.insert(participant).values({ gameId, colour: '#00ff00' }),
    );
    expect(code).toBe(SQLSTATE.checkViolation);
  });

  it('moves the games a guest played onto the new account', async () => {
    await addUser('guest-1', 'Anonymous', true);
    await addUser('account-1', 'Élise Dupont', false);
    const first = await addGame('Chocolat');
    const second = await addGame('Chat');

    for (const gameId of [first, second]) {
      await store.db
        .insert(participant)
        .values({ gameId, userId: 'guest-1', guestName: 'Élise', colour: '#ff0000' });
    }

    expect(await selectGameHistory(store.db, 'account-1')).toEqual([]);

    const moved = await attachGuestRecords(
      store.db,
      'guest-1',
      'account-1',
      perfectRound,
    );
    expect(moved.participants).toBe(2);

    const history = await selectGameHistory(store.db, 'account-1');
    expect(history.map((row) => row.topic).sort()).toEqual(['Chat', 'Chocolat']);
    // The name they played under survives the move: it is what the other players
    // saw, and rewriting it would rewrite their debrief too.
    expect(history.every((row) => row.playedAs === 'Élise')).toBe(true);
    expect(await selectGameHistory(store.db, 'guest-1')).toEqual([]);
  });

  it('takes their reports with them', async () => {
    await addUser('guest-1', 'Anonymous', true);
    await addUser('account-1', 'Élise Dupont', false);
    const gameId = await addGame('Chocolat');

    await store.db.insert(flagReport).values({
      gameId,
      reporterId: 'guest-1',
      articleTitle: 'Chocolat',
      flaggedClaim: 'le cacao vient du Brésil',
      proposedCorrection: 'le cacao vient d Amérique centrale',
      status: 'pending_human_review',
      verdict: 'uncertain',
      confidence: 40,
      reasoning: 'les sources se contredisent',
      recommendation: 'needs_more_info',
    });

    await attachGuestRecords(store.db, 'guest-1', 'account-1', perfectRound);

    const [report] = await store.db.select().from(flagReport);
    expect(report?.reporterId).toBe('account-1');
  });

  // The order the whole step rests on: the hook runs before the plugin deletes
  // the anonymous row, so after attaching, deleting it must take nothing with it.
  it('survives the anonymous row being deleted afterwards', async () => {
    await addUser('guest-1', 'Anonymous', true);
    await addUser('account-1', 'Élise Dupont', false);
    const gameId = await addGame('Chocolat');
    await store.db
      .insert(participant)
      .values({ gameId, userId: 'guest-1', guestName: 'Élise', colour: '#ff0000' });

    await attachGuestRecords(store.db, 'guest-1', 'account-1', perfectRound);
    await store.db.delete(user).where(eq(user.id, 'guest-1'));

    expect(await selectGameHistory(store.db, 'account-1')).toHaveLength(1);
  });

  // And what would happen without the attachment: `set null` leaves the row with
  // neither an identity nor — for an account player — a name. This is the
  // constraint failure that made the old "exactly one" check abort the delete.
  it('refuses to strand a participant that has no name either', async () => {
    await addUser('guest-1', 'Anonymous', true);
    const gameId = await addGame('Chocolat');
    await store.db
      .insert(participant)
      .values({ gameId, userId: 'guest-1', colour: '#ff0000' });

    const code = await rejectionCode(store.db.delete(user).where(eq(user.id, 'guest-1')));
    expect(code).toBe(SQLSTATE.checkViolation);
  });

  it('refuses to attach an account to itself', async () => {
    await expect(
      attachGuestRecords(store.db, 'account-1', 'account-1', perfectRound),
    ).rejects.toThrow(/same user/);
  });

  /*
   * Step R.2 — the window, and the trap in the obvious version of it.
   *
   * `09-query-debt.md` asked for a limit: the home shows four rounds and this
   * query had none, so every participation an account had ever had crossed the
   * wire to be thrown away in Node. What it did not say is that the home was
   * *also* filtering, on `ended_at`, after the fact — so a limit alone would
   * have been a regression rather than a saving, and the first case below is
   * the one that catches it.
   */
  describe('the window a caller asks for', () => {
    /** A round, with the two clocks the window reads. */
    const addRound = async (
      topic: string,
      startedAt: Date,
      endedAt: Date | null,
    ): Promise<string> => {
      const [row] = await store.db
        .insert(game)
        .values({
          mode: 'solo',
          topic,
          sourceUrl: `https://fr.wikipedia.org/wiki/${topic}`,
          paragraphs: ['un paragraphe'],
          totalFakes: 2,
          timeLimit: 300,
          startedAt,
          endedAt,
        })
        .returning({ id: game.id });
      if (row === undefined) throw new Error('no game');
      await store.db
        .insert(participant)
        .values({ gameId: row.id, userId: 'account-1', colour: '#ff0000' });
      return row.id;
    };

    const day = (n: number): Date => new Date(Date.UTC(2026, 0, n));

    beforeEach(async () => {
      await addUser('account-1', 'Élise Dupont', false);
    });

    // The case the home would have failed. Five abandoned rounds, all newer than
    // the one that finished: a `limit(4)` with no predicate returns four rows
    // the home then filters down to nothing, and a player who has played all
    // week is shown an empty list.
    it('spends the limit on finished rounds, not on the newest ones', async () => {
      for (const n of [2, 3, 4, 5, 6])
        await addRound(`Abandon ${String(n)}`, day(n), null);
      await addRound('Chocolat', day(1), day(1));

      const window = await selectGameHistory(store.db, 'account-1', {
        limit: 4,
        finishedOnly: true,
      });

      expect(window.map((row) => row.topic)).toEqual(['Chocolat']);
    });

    it('returns the newest first, and stops at the limit', async () => {
      await addRound('Chat', day(1), day(1));
      await addRound('Chocolat', day(2), day(2));
      await addRound('Café', day(3), day(3));

      const window = await selectGameHistory(store.db, 'account-1', { limit: 2 });

      expect(window.map((row) => row.topic)).toEqual(['Café', 'Chocolat']);
    });

    // What `exportAccount` gets, and the reason both fields default to off: an
    // export of an account is every row of it, abandoned rounds included.
    it('gives every row, unfinished ones too, when no window is asked for', async () => {
      await addRound('Chat', day(1), day(1));
      await addRound('Abandon', day(2), null);
      await addRound('Chocolat', day(3), day(3));

      const all = await selectGameHistory(store.db, 'account-1');

      expect(all.map((row) => row.topic)).toEqual(['Chocolat', 'Abandon', 'Chat']);
    });

    // The predicate is on the round's clock and not the player's: somebody who
    // left a round that ran to the end still played it.
    it('counts a round that ended without this player submitting', async () => {
      await addRound('Chocolat', day(1), day(1));

      const window = await selectGameHistory(store.db, 'account-1', {
        finishedOnly: true,
      });

      expect(window).toHaveLength(1);
      expect(window[0]?.submittedAt).toBeNull();
    });
  });
});
