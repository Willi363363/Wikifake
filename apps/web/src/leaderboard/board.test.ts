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

import { BOARD_MIN_PLAYERS, isBoardOpen, readBoard, RANKED_MODE } from './board.js';
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

  /**
   * Enough players to open a board, and one of them named.
   *
   * G.6 withholds the rows below `BOARD_MIN_PLAYERS`, so every case about *which
   * rows come back* has to get the board open first. The filler players score
   * less than anybody a case cares about, so they never displace them.
   */
  const openTheBoard = async (
    options: {
      readonly mode?: 'solo' | 'multiplayer';
      readonly atMs?: number;
      readonly region?: string;
    } = {},
  ): Promise<void> => {
    for (let index = 0; index < BOARD_MIN_PLAYERS; index += 1) {
      const id = `filler${String(index)}`;
      await addPlayer(id, `Filler${String(index)}`, options.region);
      await played({
        userId: id,
        mode: options.mode ?? 'multiplayer',
        score: 1,
        atMs: (options.atMs ?? THURSDAY) + index,
      });
    }
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
    await openTheBoard();

    const board = await readBoard(context(), 'daily', null, THURSDAY + 3_600_000);

    expect(board.open).toBe(true);
    expect(board.rows.slice(0, 2).map((row) => row.displayName)).toEqual(['Bob', 'Ada']);
    expect(board.players).toBe(2 + BOARD_MIN_PLAYERS);
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

    // Opened on the Wednesday, so both periods contain the filler rounds and
    // the only difference left is the day the case is about.
    await openTheBoard({ atMs: THURSDAY - 3_600_000 });

    const daily = await readBoard(context(), 'daily', null, THURSDAY);
    const weekly = await readBoard(context(), 'weekly', null, THURSDAY);

    expect(daily.rows).toEqual([]);
    expect(weekly.rows).toHaveLength(1 + BOARD_MIN_PLAYERS);
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

    await openTheBoard({ atMs: THURSDAY - 400 * DAY });

    expect((await readBoard(context(), 'allTime', null, THURSDAY)).rows).toHaveLength(
      1 + BOARD_MIN_PLAYERS,
    );
    expect((await readBoard(context(), 'weekly', null, THURSDAY)).rows).toEqual([]);
  });

  it('keeps a regional board to its region, and the world board to everybody', async () => {
    await addPlayer('ada', 'Ada', 'europe');
    await addPlayer('bob', 'Bob', 'americas');
    await addPlayer('cleo', 'Cleo');
    for (const id of ['ada', 'bob', 'cleo']) {
      await played({ userId: id, mode: 'multiplayer', score: 400, atMs: THURSDAY });
    }

    // Every region needs its own ten, which is the rule doing its job: a
    // regional board with two names is worse than a hidden one.
    await openTheBoard({ region: 'europe' });
    const europe = await readBoard(context(), 'daily', 'europe', THURSDAY);
    const world = await readBoard(context(), 'daily', null, THURSDAY);
    // A player with no region at all is on the board for everywhere else, which
    // `effectiveRegion` decided and the generated column computes.
    const elsewhere = await readBoard(context(), 'daily', 'other', THURSDAY);

    expect(europe.rows.map((row) => row.displayName)).toContain('Ada');
    // Cleo is alone in `other`, so that board stays closed and hands back no
    // rows at all — the threshold, per region.
    expect(elsewhere.open).toBe(false);
    expect(elsewhere.rows).toEqual([]);
    expect(world.rows).toHaveLength(3 + BOARD_MIN_PLAYERS);
  });

  it('shows a chosen region over a derived one', async () => {
    // G.1's promise, from the end that matters: the board a player appears on is
    // the one they chose.
    await addPlayer('ada', 'Ada', 'europe');
    await setChosenRegion(store.db, 'ada', 'americas');
    await played({ userId: 'ada', mode: 'multiplayer', score: 400, atMs: THURSDAY });

    await openTheBoard({ region: 'americas' });

    expect(
      (await readBoard(context(), 'daily', 'americas', THURSDAY)).rows.map(
        (row) => row.displayName,
      ),
    ).toContain('Ada');
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

    await openTheBoard();
    const board = await readBoard(context(), 'daily', null, THURSDAY);

    expect(board.rows.map((row) => row.displayName)).not.toContain('x');
    expect(board.players).toBe(BOARD_MIN_PLAYERS);
  });

  it('counts players and not scores, and shows each one once', async () => {
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

    await openTheBoard();
    const board = await readBoard(context(), 'daily', null, THURSDAY);

    // Five entries for one player, one player counted — and **one row**, which
    // is what G.7 changed. This case asserted five rows until then, which is
    // the defect it was quietly documenting: a player with five good rounds
    // took five of the fifty places, and "your own rank" had no meaning.
    expect(board.players).toBe(1 + BOARD_MIN_PLAYERS);
    expect(board.rows.filter((row) => row.displayName === 'Ada')).toHaveLength(1);
    // And it is their best.
    expect(board.rows.find((row) => row.displayName === 'Ada')?.score).toBe(104);
  });
});

describe.skipIf(url === null)('G.6 — the threshold, in the read path', () => {
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

  /** `count` players, one round each, all inside Thursday. */
  const playersOnTheBoard = async (count: number): Promise<void> => {
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
        score: 100 + index,
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

  it('hands back no rows at all one player short', async () => {
    /*
     * The rule the track states — *"under it, the screen says the ranking opens
     * soon rather than showing three names"* — held **in the read path**.
     *
     * Withheld rather than hidden, and that is the point: a screen that decided
     * not to render the rows is a promise, and a read that never returns them is
     * a fact. A later refactor of the markup cannot leak a name it does not
     * have.
     */
    await playersOnTheBoard(BOARD_MIN_PLAYERS - 1);

    const board = await readBoard(context(), 'daily', null, THURSDAY + 3_600_000);

    expect(board.open).toBe(false);
    expect(board.rows).toEqual([]);
    // The count still comes back, because the screen says it: a number, not a
    // name.
    expect(board.players).toBe(BOARD_MIN_PLAYERS - 1);
  });

  it('opens on the player that reaches the threshold', async () => {
    await playersOnTheBoard(BOARD_MIN_PLAYERS);

    const board = await readBoard(context(), 'daily', null, THURSDAY + 3_600_000);

    expect(board.open).toBe(true);
    expect(board.rows).toHaveLength(BOARD_MIN_PLAYERS);
  });

  it('decides on players, so one player playing all day opens nothing', async () => {
    // `countBoardPlayers` counts `distinct user_id` for exactly this: a board
    // that opened at ten *scores* would open when one player had played ten
    // rounds, which is the abandoned-looking board the rule exists to prevent.
    await playersOnTheBoard(1);
    for (let index = 0; index < 20; index += 1) {
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
          userId: 'p0',
          colour: '#1f574d',
        })
        .returning({ id: participant.id });
      await recordSubmission(store.db, {
        gameId: (row as { id: string }).id,
        participantId: (player as { id: string }).id,
        marked: [1],
        score: 500,
        truePositives: 3,
        falsePositives: 0,
        hintsUsed: 0,
        hintPenalty: 0,
        scoreStolen: 0,
        timeBonus: 0,
        perfect: true,
        at: new Date(THURSDAY + 10_000 + index * 1000),
      });
    }

    const board = await readBoard(context(), 'daily', null, THURSDAY + 3_600_000);

    expect(board.players).toBe(1);
    expect(board.open).toBe(false);
    expect(board.rows).toEqual([]);
  });

  it('is one number, and one function that reads it', () => {
    // The screen interpolates `BOARD_MIN_PLAYERS` into its promise and the read
    // path compares against it, so the two cannot disagree about what opens.
    expect(isBoardOpen(BOARD_MIN_PLAYERS - 1)).toBe(false);
    expect(isBoardOpen(BOARD_MIN_PLAYERS)).toBe(true);
    expect(isBoardOpen(0)).toBe(false);
  });
});
