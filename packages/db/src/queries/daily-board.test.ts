// The day's board — step N.6, against a real Postgres.
//
// It is four joins and an order, so every case is one: a fake would only prove
// the fake agrees with itself.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  countDailyPlayers,
  selectDailyBoard,
  selectOwnDailyRank,
} from './daily-board.js';
import { claimDay, fillDay } from './daily.js';
import { recordEligibleScore } from './leaderboard.js';
import { createGame } from './start.js';
import { user } from '../schema/auth.js';
import { profile } from '../schema/profile.js';
import { openTestDatabase, testDatabaseUrl } from '../testing/database.js';
import type { TestDatabase } from '../testing/database.js';

const url = testDatabaseUrl();

const DAY = 20_706;
const AT = new Date('2026-09-10T04:00:00.000Z');

const ARTICLE = {
  topic: 'Chat',
  sourceUrl: 'https://fr.wikipedia.org/wiki/Chat',
  paragraphs: ['un', 'deux', 'trois'],
  solution: [
    {
      paragraphIndex: 1,
      falseInfoNumber: 1,
      falseStatement: 'faux',
      originalText: 'vrai',
      explanation: 'parce que',
      hint: 'un indice',
    },
  ],
  totalFakes: 1,
};

describe.skipIf(url === null)('N.6 — the day’s board', () => {
  let store: TestDatabase;

  beforeAll(async () => {
    store = await openTestDatabase(url as string);
  });
  beforeEach(async () => {
    await store.truncate();
    await claimDay(store.db, DAY, AT);
    await fillDay(store.db, DAY, ARTICLE, AT);
  });
  afterAll(async () => {
    await store.close();
  });

  /** A player with a profile, which is what a board needs to print a name. */
  const addPlayer = async (id: string): Promise<void> => {
    await store.db
      .insert(user)
      .values({ id, name: id, email: `${id}@example.test`, emailVerified: false });
    await store.db
      .insert(profile)
      .values({ userId: id, displayName: id, displayNameKey: id });
  };

  /** A finished round on a day, and its score made eligible. */
  const played = async (options: {
    readonly userId: string | null;
    readonly score: number;
    readonly at: Date;
    readonly day?: number | null;
  }): Promise<void> => {
    const started = await createGame(store.db, {
      mode: 'solo',
      topic: 'Chat',
      sourceUrl: 'https://fr.wikipedia.org/wiki/Chat',
      paragraphs: ['un', 'deux', 'trois'],
      timeLimit: 300,
      fromCache: true,
      solution: ARTICLE.solution,
      dailyDay: options.day === undefined ? DAY : options.day,
      players: [
        {
          userId: options.userId,
          guestName: options.userId === null ? 'invité' : null,
          colour: '#1f574d',
        },
      ],
    });

    await recordEligibleScore(store.db, {
      participantId: started.participantIds[0] as string,
      userId: options.userId,
      mode: 'solo',
      score: options.score,
      finishedAt: options.at,
    });
  };

  it('ranks the day by score, best first', async () => {
    await addPlayer('ada');
    await addPlayer('grace');
    await played({ userId: 'ada', score: 300, at: AT });
    await played({ userId: 'grace', score: 700, at: AT });

    const board = await selectDailyBoard(store.db, DAY, 10);

    expect(board.map((row) => row.displayName)).toEqual(['grace', 'ada']);
    expect(board[0]?.score).toBe(700);
  });

  it('breaks a tie in favour of whoever got there first', async () => {
    await addPlayer('ada');
    await addPlayer('grace');
    await played({ userId: 'grace', score: 500, at: new Date(AT.getTime() + 60_000) });
    await played({ userId: 'ada', score: 500, at: AT });

    expect((await selectDailyBoard(store.db, DAY, 10)).map((r) => r.displayName)).toEqual(
      ['ada', 'grace'],
    );
  });

  /*
   * The whole difference from G.4's boards. Those rank each player's *best*
   * round in a period because a player can play a period fifty times; N.5
   * refuses a second attempt, so one player already has one round. This is the
   * assertion that keeps the two rules agreeing.
   */
  it('gives one player one row, without a distinct-on to do it', async () => {
    await addPlayer('ada');
    await played({ userId: 'ada', score: 300, at: AT });

    expect(await selectDailyBoard(store.db, DAY, 10)).toHaveLength(1);
  });

  it('shows nothing from another day', async () => {
    await addPlayer('ada');
    await addPlayer('grace');
    await played({ userId: 'ada', score: 300, at: AT });
    await claimDay(store.db, DAY + 1, AT);
    await fillDay(store.db, DAY + 1, ARTICLE, AT);
    await played({ userId: 'grace', score: 900, at: AT, day: DAY + 1 });

    expect((await selectDailyBoard(store.db, DAY, 10)).map((r) => r.displayName)).toEqual(
      ['ada'],
    );
  });

  /*
   * An ordinary solo round on the same article is not the day's round. This is
   * why N.5 put a column on `game` rather than matching on `source_url`: the
   * same page can come up again, and the board would rank a stranger's round.
   */
  it('shows nothing from a round that was not the day’s', async () => {
    await addPlayer('ada');
    await played({ userId: 'ada', score: 800, at: AT, day: null });

    expect(await selectDailyBoard(store.db, DAY, 10)).toEqual([]);
  });

  it('shows no guest, who has no name to print', async () => {
    await addPlayer('ada');
    await played({ userId: 'ada', score: 300, at: AT });
    await played({ userId: null, score: 900, at: AT });

    expect((await selectDailyBoard(store.db, DAY, 10)).map((r) => r.displayName)).toEqual(
      ['ada'],
    );
  });

  it('counts the players who finished, not the rounds', async () => {
    await addPlayer('ada');
    await addPlayer('grace');
    await played({ userId: 'ada', score: 300, at: AT });
    await played({ userId: 'grace', score: 400, at: AT });
    await played({ userId: null, score: 900, at: AT });

    expect(await countDailyPlayers(store.db, DAY)).toBe(2);
  });
});

describe.skipIf(url === null)('N.6 — a player’s own standing', () => {
  let store: TestDatabase;

  beforeAll(async () => {
    store = await openTestDatabase(url as string);
  });
  beforeEach(async () => {
    await store.truncate();
    await claimDay(store.db, DAY, AT);
    await fillDay(store.db, DAY, ARTICLE, AT);
  });
  afterAll(async () => {
    await store.close();
  });

  const addPlayer = async (id: string): Promise<void> => {
    await store.db
      .insert(user)
      .values({ id, name: id, email: `${id}@example.test`, emailVerified: false });
    await store.db
      .insert(profile)
      .values({ userId: id, displayName: id, displayNameKey: id });
  };

  const played = async (userId: string, score: number, at: Date): Promise<void> => {
    const started = await createGame(store.db, {
      mode: 'solo',
      topic: 'Chat',
      sourceUrl: 'https://fr.wikipedia.org/wiki/Chat',
      paragraphs: ['un', 'deux', 'trois'],
      timeLimit: 300,
      fromCache: true,
      solution: ARTICLE.solution,
      dailyDay: DAY,
      players: [{ userId, colour: '#1f574d' }],
    });
    await recordEligibleScore(store.db, {
      participantId: started.participantIds[0] as string,
      userId,
      mode: 'solo',
      score,
      finishedAt: at,
    });
  };

  it('is one more than the number of players who did better', async () => {
    await addPlayer('ada');
    await addPlayer('grace');
    await addPlayer('alan');
    await played('grace', 900, AT);
    await played('alan', 700, AT);
    await played('ada', 300, AT);

    expect((await selectOwnDailyRank(store.db, DAY, 'ada'))?.rank).toBe(3);
  });

  // Two players tied share a rank — what every scoreboard a player has read does.
  it('shares a rank between two players who tied', async () => {
    await addPlayer('ada');
    await addPlayer('grace');
    await played('ada', 500, AT);
    await played('grace', 500, AT);

    expect((await selectOwnDailyRank(store.db, DAY, 'ada'))?.rank).toBe(1);
  });

  /*
   * Null is not last. A player who has not played today is not on this board,
   * and a screen says so rather than printing a number.
   */
  it('is null for a player who has not played today', async () => {
    await addPlayer('ada');
    await addPlayer('grace');
    await played('grace', 500, AT);

    expect(await selectOwnDailyRank(store.db, DAY, 'ada')).toBeNull();
  });

  // The rank and the row order are the same tie-break, so they cannot disagree.
  it('agrees with the order the board prints', async () => {
    await addPlayer('ada');
    await addPlayer('grace');
    await played('ada', 500, AT);
    await played('grace', 500, new Date(AT.getTime() + 60_000));

    const board = await selectDailyBoard(store.db, DAY, 10);
    const grace = await selectOwnDailyRank(store.db, DAY, 'grace');

    expect(board.findIndex((row) => row.displayName === 'grace') + 1).toBe(grace?.rank);
  });
});
