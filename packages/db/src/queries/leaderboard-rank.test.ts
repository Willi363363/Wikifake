// One row per player, and a player's own rank — step G.7, against a real
// Postgres.
//
// Split from `leaderboard.test.ts` when it crossed the 500-line cap. G.2's write
// path and the rebuild that holds it honest stay there; what is here is the
// board's shape and the rank read off it.
//
// **The defect this step found is the first case below.** The board listed
// rounds, so a player with five good rounds took five of the fifty rows — and a
// G.6 case asserted exactly that, which is a suite documenting a defect rather
// than catching one. "Your own rank" has no meaning when a player has five of
// them.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { recordSubmission } from './session.js';
import { selectBoard, selectOwnRank } from './leaderboard.js';
import { game, participant } from '../schema/game.js';
import { profile } from '../schema/profile.js';
import { user } from '../schema/auth.js';
import { openTestDatabase, testDatabaseUrl } from '../testing/database.js';
import type { TestDatabase } from '../testing/database.js';

const url = testDatabaseUrl();
describe.skipIf(url === null)('G.7 — one row per player, and a player’s own rank', () => {
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

  const AT = new Date('2026-09-10T12:00:00.000Z');
  const board = { mode: 'multiplayer' as const, window: null, region: null };

  /** An account with a pseudonym, so the board's inner join finds it. */
  const addPlayer = async (id: string): Promise<void> => {
    await store.db
      .insert(user)
      .values({ id, name: id, email: `${id}@example.test`, emailVerified: false });
    await store.db.insert(profile).values({
      userId: id,
      displayName: id,
      displayNameKey: id,
    });
  };

  /** A graded room round for this player, at this score and instant. */
  const scored = async (userId: string, score: number, atMs: number): Promise<void> => {
    const [row] = await store.db
      .insert(game)
      .values({
        mode: 'multiplayer',
        topic: 'Chat',
        sourceUrl: 'https://fr.wikipedia.org/wiki/Chat',
        paragraphs: ['un paragraphe'],
        totalFakes: 3,
        timeLimit: 300,
      })
      .returning({ id: game.id });
    const [player] = await store.db
      .insert(participant)
      .values({ gameId: (row as { id: string }).id, userId, colour: '#1f574d' })
      .returning({ id: participant.id });

    await recordSubmission(store.db, {
      gameId: (row as { id: string }).id,
      participantId: (player as { id: string }).id,
      marked: [1],
      score,
      truePositives: 3,
      falsePositives: 0,
      hintsUsed: 0,
      hintPenalty: 0,
      scoreStolen: 0,
      timeBonus: 0,
      perfect: true,
      at: new Date(atMs),
    });
  };

  it('gives a player one row, their best', async () => {
    /*
     * The defect G.7 found in G.5: the board listed entries, so a player with
     * five good rounds took five of the fifty rows — and "your own rank" has no
     * meaning when a player has five of them.
     */
    await addPlayer('ada');
    await scored('ada', 100, AT.getTime());
    await scored('ada', 900, AT.getTime() + 1000);
    await scored('ada', 400, AT.getTime() + 2000);

    const rows = await selectBoard(store.db, { ...board, limit: 50 });

    expect(rows).toHaveLength(1);
    expect(rows[0]?.score).toBe(900);
  });

  it('breaks a tie with itself by the earlier round', async () => {
    // `distinct on` picks the best, and among equal bests the first reached —
    // the board's own tie-break, applied to a player against themselves.
    await addPlayer('ada');
    await scored('ada', 900, AT.getTime() + 5000);
    await scored('ada', 900, AT.getTime());

    const rows = await selectBoard(store.db, { ...board, limit: 50 });

    expect(rows[0]?.finishedAt.getTime()).toBe(AT.getTime());
  });

  it('ranks players by their best, not by how much they played', async () => {
    await addPlayer('ada');
    await addPlayer('bob');
    // Bob plays five mediocre rounds; Ada plays one good one.
    for (let index = 0; index < 5; index += 1) {
      await scored('bob', 300 + index, AT.getTime() + index * 1000);
    }
    await scored('ada', 800, AT.getTime() + 9000);

    const rows = await selectBoard(store.db, { ...board, limit: 50 });

    expect(rows.map((row) => row.displayName)).toEqual(['ada', 'bob']);
  });

  it('tells a player where they stand', async () => {
    await addPlayer('ada');
    await addPlayer('bob');
    await addPlayer('cleo');
    await scored('ada', 900, AT.getTime());
    await scored('bob', 600, AT.getTime() + 1000);
    await scored('cleo', 300, AT.getTime() + 2000);

    expect(await selectOwnRank(store.db, board, 'ada')).toEqual({
      userId: 'ada',
      rank: 1,
      score: 900,
      finishedAt: AT,
    });
    expect((await selectOwnRank(store.db, board, 'cleo'))?.rank).toBe(3);
  });

  it('agrees with the order the board renders', async () => {
    // The rank and the rows are two queries, so this is the assertion that they
    // cannot disagree: every row's position must equal its own rank.
    await addPlayer('ada');
    await addPlayer('bob');
    await addPlayer('cleo');
    await scored('ada', 500, AT.getTime());
    await scored('bob', 900, AT.getTime() + 1000);
    await scored('cleo', 500, AT.getTime() + 2000);

    const rows = await selectBoard(store.db, { ...board, limit: 50 });

    for (const [index, row] of rows.entries()) {
      const own = await selectOwnRank(store.db, board, row.userId);
      expect(own?.rank, `${row.displayName} at position ${String(index + 1)}`).toBe(
        index + 1,
      );
    }
  });

  it('gives tied players the same rank', async () => {
    // Competition ranking on the *score*: two players tied share a rank. The
    // board still orders them, by who got there first.
    await addPlayer('ada');
    await addPlayer('bob');
    await scored('ada', 500, AT.getTime());
    await scored('bob', 500, AT.getTime());

    expect((await selectOwnRank(store.db, board, 'ada'))?.rank).toBe(1);
    expect((await selectOwnRank(store.db, board, 'bob'))?.rank).toBe(1);
  });

  it('says a player is not on the board rather than ranking them last', async () => {
    // Null and not a number: they are not last, they are not on this board.
    await addPlayer('ada');
    await addPlayer('bob');
    await scored('ada', 500, AT.getTime());

    expect(await selectOwnRank(store.db, board, 'bob')).toBeNull();
    expect(await selectOwnRank(store.db, board, 'nobody')).toBeNull();
  });

  it('ranks within the period it was asked about', async () => {
    // The rank uses the board's own filters, so a player who was first
    // yesterday is not on today's board at all.
    await addPlayer('ada');
    await scored('ada', 900, AT.getTime() - 86_400_000);

    const today = {
      mode: 'multiplayer' as const,
      window: {
        fromMs: Date.UTC(2026, 8, 10),
        toMs: Date.UTC(2026, 8, 11),
      },
      region: null,
    };

    expect(await selectOwnRank(store.db, board, 'ada')).not.toBeNull();
    expect(await selectOwnRank(store.db, today, 'ada')).toBeNull();
  });

  it('pages the rows around a rank', async () => {
    // G.7's "and the rows around it": an offset into the same order the board
    // renders, so the neighbours are the real ones.
    await addPlayer('ada');
    for (let index = 0; index < 9; index += 1) {
      const id = `p${String(index)}`;
      await addPlayer(id);
      await scored(id, 900 - index * 10, AT.getTime() + index * 1000);
    }
    await scored('ada', 700, AT.getTime() + 20_000);

    const own = await selectOwnRank(store.db, board, 'ada');
    expect(own?.rank).toBe(10);

    /*
     * The arithmetic, spelled out because the screen has to get it right and it
     * is off by one in the obvious direction.
     *
     * `offset` is zero-based: a rank of R sits at offset R - 1. So a window of
     * one row either side starts at `R - 2` and takes three, which is positions
     * R-1, R and R+1.
     *
     * Ada is last of ten, so the row below does not exist and the window comes
     * back short rather than padded. A screen that assumed three rows would
     * render an empty one.
     */
    const around = await selectBoard(store.db, {
      ...board,
      limit: 3,
      offset: (own?.rank ?? 1) - 2,
    });

    expect(around.map((row) => row.displayName)).toEqual(['p8', 'ada']);

    // And from the middle, where all three exist.
    const middle = await selectBoard(store.db, { ...board, limit: 3, offset: 3 });
    expect(middle.map((row) => row.displayName)).toEqual(['p3', 'p4', 'p5']);
  });
});
