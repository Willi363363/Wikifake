// What a board asks for, against a real Postgres — step G.5.
//
// The screen's suite renders rows it was handed. This one is about which rows it
// gets: the mode the boards rank, the window a period covers, and the region a
// regional board keeps to.
//
// **The decision under test is the owner's**: room rounds only, because a solo
// topic is one the player chose. So the case that matters most is a solo round
// with a huge score appearing on no board at all — while still being in the
// table, which is what makes the decision reversible.
// No `drizzle-orm` import: phase 2's exit gate keeps free-form SQL out of every
// package but `@wikifake/db`, and `apps/web` does not depend on it. So the one
// update this file needs goes through `setChosenRegion` — G.1's own query, which
// is also the path production takes.
import {
  game,
  participant,
  profile,
  recordSubmission,
  setChosenRegion,
  user,
} from '@wikifake/db';
import { periodIndexOf } from '@wikifake/domain';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { readBoard, RANKED_MODE } from './board.js';
import { openWebTestDatabase, webTestDatabaseUrl } from '../testing/database.js';
import type { TestDatabase } from '@wikifake/db/testing';

const url = webTestDatabaseUrl();
const DAY = 86_400_000;
/** 2026-09-10, a Thursday, in the week that began Monday the 7th. */
const THURSDAY = 20_706 * DAY;

describe.skipIf(url === null)('G.5 — the board a screen is handed', () => {
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

  /** An account with a pseudonym, and a region if one is given. */
  const addPlayer = async (id: string, name: string, region?: string): Promise<void> => {
    await store.db
      .insert(user)
      .values({ id, name: id, email: `${id}@example.test`, emailVerified: false });
    await store.db.insert(profile).values({
      userId: id,
      displayName: name,
      displayNameKey: name.toLowerCase(),
      ...(region === undefined ? {} : { derivedRegion: region }),
    });
  };

  /** A graded round, through the real write path so the entry is written too. */
  const played = async (options: {
    readonly userId: string;
    readonly mode: 'solo' | 'multiplayer';
    readonly score: number;
    readonly atMs: number;
  }): Promise<void> => {
    const [row] = await store.db
      .insert(game)
      .values({
        mode: options.mode,
        topic: 'Chat',
        sourceUrl: 'https://fr.wikipedia.org/wiki/Chat',
        paragraphs: ['un paragraphe'],
        totalFakes: 3,
        timeLimit: 300,
      })
      .returning({ id: game.id });
    if (row === undefined) throw new Error('no game');

    const [player] = await store.db
      .insert(participant)
      .values({ gameId: row.id, userId: options.userId, colour: '#1f574d' })
      .returning({ id: participant.id });
    if (player === undefined) throw new Error('no participant');

    await recordSubmission(store.db, {
      gameId: row.id,
      participantId: player.id,
      marked: [1],
      score: options.score,
      truePositives: 3,
      falsePositives: 0,
      hintsUsed: 0,
      hintPenalty: 0,
      scoreStolen: 0,
      timeBonus: 0,
      perfect: true,
      at: new Date(options.atMs),
    });
  };

  it('ranks room rounds', async () => {
    await addPlayer('ada', 'Ada');
    await addPlayer('bob', 'Bob');
    await played({ userId: 'ada', mode: 'multiplayer', score: 400, atMs: THURSDAY });
    await played({
      userId: 'bob',
      mode: 'multiplayer',
      score: 900,
      atMs: THURSDAY + 1000,
    });

    const board = await readBoard(context(), 'daily', null, THURSDAY + 3_600_000);

    expect(board.rows.map((row) => row.displayName)).toEqual(['Bob', 'Ada']);
    expect(board.players).toBe(2);
  });

  it('ranks a solo round nowhere, however big the score', async () => {
    /*
     * The owner's decision, and the case that proves it. A solo topic is one the
     * player chose — an easy article gives three falsifications found quickly,
     * which is a high score — so a solo round is on no board.
     *
     * And the entry still exists, which is what makes this reversible without a
     * migration: G.2 writes one for every graded round.
     */
    await addPlayer('ada', 'Ada');
    await played({ userId: 'ada', mode: 'solo', score: 99_999, atMs: THURSDAY });

    const board = await readBoard(context(), 'allTime', null, THURSDAY);

    expect(board.rows).toEqual([]);
    expect(board.players).toBe(0);
    expect(RANKED_MODE).toBe('multiplayer');
  });

  it('keeps a daily board to its day, and a weekly one to its week', async () => {
    await addPlayer('ada', 'Ada');
    // Wednesday: the day before, inside the same ISO week.
    await played({
      userId: 'ada',
      mode: 'multiplayer',
      score: 500,
      atMs: THURSDAY - 3_600_000,
    });

    const daily = await readBoard(context(), 'daily', null, THURSDAY);
    const weekly = await readBoard(context(), 'weekly', null, THURSDAY);

    expect(daily.rows).toEqual([]);
    expect(weekly.rows).toHaveLength(1);
    // The same calendar quests use — G.3's whole reason for the shared module.
    expect(periodIndexOf('weekly', THURSDAY - 3_600_000)).toBe(
      periodIndexOf('weekly', THURSDAY),
    );
  });

  it('puts every round on the all-time board', async () => {
    await addPlayer('ada', 'Ada');
    await played({
      userId: 'ada',
      mode: 'multiplayer',
      score: 500,
      atMs: THURSDAY - 400 * DAY,
    });

    expect((await readBoard(context(), 'allTime', null, THURSDAY)).rows).toHaveLength(1);
    expect((await readBoard(context(), 'weekly', null, THURSDAY)).rows).toEqual([]);
  });

  it('keeps a regional board to its region, and the world board to everybody', async () => {
    await addPlayer('ada', 'Ada', 'europe');
    await addPlayer('bob', 'Bob', 'americas');
    await addPlayer('cleo', 'Cleo');
    for (const id of ['ada', 'bob', 'cleo']) {
      await played({ userId: id, mode: 'multiplayer', score: 400, atMs: THURSDAY });
    }

    const europe = await readBoard(context(), 'daily', 'europe', THURSDAY);
    const world = await readBoard(context(), 'daily', null, THURSDAY);
    // A player with no region at all is on the board for everywhere else, which
    // `effectiveRegion` decided and the generated column computes.
    const elsewhere = await readBoard(context(), 'daily', 'other', THURSDAY);

    expect(europe.rows.map((row) => row.displayName)).toEqual(['Ada']);
    expect(elsewhere.rows.map((row) => row.displayName)).toEqual(['Cleo']);
    expect(world.rows).toHaveLength(3);
  });

  it('shows a chosen region over a derived one', async () => {
    // G.1's promise, from the end that matters: the board a player appears on is
    // the one they chose.
    await addPlayer('ada', 'Ada', 'europe');
    await setChosenRegion(store.db, 'ada', 'americas');
    await played({ userId: 'ada', mode: 'multiplayer', score: 400, atMs: THURSDAY });

    expect((await readBoard(context(), 'daily', 'americas', THURSDAY)).rows).toHaveLength(
      1,
    );
    expect((await readBoard(context(), 'daily', 'europe', THURSDAY)).rows).toEqual([]);
  });

  it('leaves out a player with no pseudonym', async () => {
    // The inner join is the filter: a board shows names and only a profile has
    // one. An account that never chose one has no rank to be given.
    await store.db.insert(user).values({
      id: 'nameless',
      name: 'x',
      email: 'x@example.test',
      emailVerified: false,
    });
    await played({ userId: 'nameless', mode: 'multiplayer', score: 800, atMs: THURSDAY });

    expect((await readBoard(context(), 'daily', null, THURSDAY)).rows).toEqual([]);
  });

  it('counts players and not scores', async () => {
    // G.6's threshold reads this, and a board that opened at three *scores*
    // would open when one player had played three rounds.
    await addPlayer('ada', 'Ada');
    for (let index = 0; index < 5; index += 1) {
      await played({
        userId: 'ada',
        mode: 'multiplayer',
        score: 100 + index,
        atMs: THURSDAY + index * 1000,
      });
    }

    const board = await readBoard(context(), 'daily', null, THURSDAY);

    expect(board.rows).toHaveLength(5);
    expect(board.players).toBe(1);
  });
});
