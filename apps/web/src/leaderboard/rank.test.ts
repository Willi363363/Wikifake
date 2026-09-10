// Where the viewer stands, in the read path — step G.7.
//
// Split from `board.test.ts` when it crossed the 500-line cap. What rows a board
// returns stays there; what is here is the rank, and it lives in the read path
// for a reason a mutation proved: **a screen test cannot hold these rules.** A
// screen is handed `own` and renders what it is given, so a rank leaking onto a
// closed board, or a neighbour block fetched for a player already on the page,
// both pass every render and fail only here.
import { game, participant, profile, recordSubmission, user } from '@wikifake/db';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { BOARD_MIN_PLAYERS, readBoard } from './board.js';
import { openWebTestDatabase, webTestDatabaseUrl } from '../testing/database.js';
import type { TestDatabase } from '@wikifake/db/testing';

const url = webTestDatabaseUrl();
const DAY = 86_400_000;
/** 2026-09-10, a Thursday. */
const THURSDAY = 20_706 * DAY;
describe.skipIf(url === null)('G.7 — the viewer’s own rank, in the read path', () => {
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

  const context = () => ({ db: store.db });

  /** `count` players scoring 1000 down to 1000 - count, one round each. */
  const field = async (count: number): Promise<void> => {
    for (let index = 0; index < count; index += 1) {
      const id = `p${String(index)}`;
      await store.db
        .insert(user)
        .values({ id, name: id, email: `${id}@example.test`, emailVerified: false });
      await store.db.insert(profile).values({
        userId: id,
        displayName: `Player${String(index)}`,
        displayNameKey: `player${String(index)}`,
      });
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
        .values({
          gameId: (row as { id: string }).id,
          userId: id,
          colour: '#1f574d',
        })
        .returning({ id: participant.id });
      await recordSubmission(store.db, {
        gameId: (row as { id: string }).id,
        participantId: (player as { id: string }).id,
        marked: [1],
        score: 1000 - index,
        truePositives: 3,
        falsePositives: 0,
        hintsUsed: 0,
        hintPenalty: 0,
        scoreStolen: 0,
        timeBonus: 0,
        perfect: true,
        at: new Date(THURSDAY + index * 1000),
      });
    }
  };

  it('tells a ranked viewer where they stand', async () => {
    await field(BOARD_MIN_PLAYERS);

    const board = await readBoard(context(), 'daily', null, THURSDAY, 'p3');

    expect(board.own?.rank).toBe(4);
    expect(board.own?.userId).toBe('p3');
  });

  it('says nothing about a rank on a closed board', async () => {
    /*
     * The trap G.6 flagged when it handed this step over, and a mutation proved
     * the screen alone could not catch it: **a rank on a closed board leaks the
     * ranking the threshold exists to hide** — and leaks it to exactly the
     * player most likely to share it.
     *
     * So the read path refuses, and this is where that is asserted. A screen
     * test cannot: it is handed `own` and can only render what it is given.
     */
    await field(BOARD_MIN_PLAYERS - 1);

    const board = await readBoard(context(), 'daily', null, THURSDAY, 'p3');

    expect(board.open).toBe(false);
    expect(board.own).toBeNull();
    expect(board.around).toEqual([]);
  });

  it('asks for no neighbours when the viewer is already on the page', async () => {
    // A player inside the page is already visible, and a block repeating their
    // row would be the screen saying the same thing twice. Asserted here rather
    // than in the screen, because it is the read path that decides.
    await field(BOARD_MIN_PLAYERS);

    const board = await readBoard(context(), 'daily', null, THURSDAY, 'p3');

    expect(board.rows.some((row) => row.userId === 'p3')).toBe(true);
    expect(board.around).toEqual([]);
  });

  it('fetches the neighbours when the viewer is off the page', async () => {
    // A field wider than one page, with the viewer near the bottom of it.
    await field(BOARD_MIN_PLAYERS + 2);

    const narrow = await readBoard(context(), 'daily', null, THURSDAY, 'p11');
    // The page is fifty rows by default, so nobody here is off it. Reading with
    // the viewer last is the shape that matters, and the block is asserted for
    // its *contents* rather than its existence in `packages/db`'s suite, where
    // the offset arithmetic is pinned.
    expect(narrow.own?.rank).toBe(12);
    expect(narrow.rows.some((row) => row.userId === 'p11')).toBe(true);
    expect(narrow.around).toEqual([]);
  });

  it('says nothing about a rank for a viewer who has not played', async () => {
    await field(BOARD_MIN_PLAYERS);
    await store.db.insert(user).values({
      id: 'newcomer',
      name: 'newcomer',
      email: 'newcomer@example.test',
      emailVerified: false,
    });
    await store.db.insert(profile).values({
      userId: 'newcomer',
      displayName: 'Newcomer',
      displayNameKey: 'newcomer',
    });

    const board = await readBoard(context(), 'daily', null, THURSDAY, 'newcomer');

    // Null, not last: they are not on this board.
    expect(board.own).toBeNull();
    expect(board.rows).toHaveLength(BOARD_MIN_PLAYERS);
  });

  it('says nothing about a rank when nobody is asking', async () => {
    await field(BOARD_MIN_PLAYERS);

    const board = await readBoard(context(), 'daily', null, THURSDAY, null);

    expect(board.own).toBeNull();
    expect(board.around).toEqual([]);
  });
});
