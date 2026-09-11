// Step E.3b.1 — a multiplayer round reaching Postgres, against a real one.
//
// `round.test.ts` in `@wikifake/domain` proves the effect carries the right
// results. This proves the other half: that being handed one writes the rows —
// the submission, the marks, the end of the game, and the `player_stats`
// increment that hangs off `recordSubmission`'s transaction.
//
// Against a real database rather than a mock, for the reason every other suite
// in this package is: what is being claimed is that the writes *land*, and a
// mock that recorded the calls would prove the calls were made.
//
// **The number this step is actually about is `gamesFinished`.** Before it, a
// multiplayer round left `submitted_at` null for every player for ever, so a
// profile counted rooms as games started and never finished. The last case here
// is that claim, and it is the one that would have failed a week ago.
//
// Read back through `@wikifake/db`'s own named queries rather than with an ORM
// of its own: `apps/realtime` is a transport, and a transport that grew a
// `drizzle-orm` dependency to check its work would be one row of free-form SQL
// away from the rule phase 2 closed. `selectLeaderboard`, `selectAnswers` and
// `selectGameHistory` are what production reads these rows with.
import {
  createGame,
  selectAnswers,
  selectGameHistory,
  selectLeaderboard,
  selectPlayerStats,
  user,
  type Database,
} from '@wikifake/db';
import { openScratchDatabase, scratchDatabaseUrlOrNull } from '@wikifake/db/testing';
import type { TestDatabase } from '@wikifake/db/testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { writeResults } from './results.js';
import type { RecordResults } from './service.js';

const url = scratchDatabaseUrlOrNull('realtime');

/** The clock the service injects, fixed so the rows can be asserted on. */
const AT = new Date('2026-09-07T12:00:00.000Z');

describe.skipIf(url === null)('E.3b.1 — writing a multiplayer round down', () => {
  let store: TestDatabase;
  let db: Database['db'];

  beforeAll(async () => {
    store = await openScratchDatabase('realtime');
    db = store.db;
  });

  beforeEach(async () => {
    await store.truncate();
  });

  afterAll(async () => {
    await store.close();
  });

  /** A room's round, as `generation.ts` opens one: two players, three fakes. */
  const openRound = async (accounts: Readonly<Record<string, string | null>>) => {
    for (const [, userId] of Object.entries(accounts)) {
      if (userId === null) continue;
      await db
        .insert(user)
        .values({ id: userId, name: userId, email: `${userId}@example.test` });
    }

    const names = Object.keys(accounts);
    const started = await createGame(db, {
      mode: 'multiplayer',
      roomCode: null,
      topic: 'Chat',
      sourceUrl: 'https://fr.wikipedia.org/wiki/Chat',
      paragraphs: ['un', 'deux', 'trois', 'quatre'],
      timeLimit: 300,
      fromCache: false,
      solution: [1, 2, 3].map((n) => ({
        paragraphIndex: n,
        falseInfoNumber: n,
        falseStatement: `faux ${String(n)}`,
        originalText: `vrai ${String(n)}`,
        explanation: 'because',
        hint: 'a hint',
      })),
      players: names.map((name, index) => ({
        guestName: name,
        // Step E.3b.2 is what will make this anything but null for a room. The
        // parameter is here so this suite can prove the counters move the day
        // it does — the write path is the same one either way.
        userId: accounts[name] ?? null,
        colour: `#00000${String(index)}`,
      })),
    });

    return {
      gameId: started.gameId,
      participants: Object.fromEntries(
        names.map((name, index) => [name, started.participantIds[index] as string]),
      ),
    };
  };

  const breakdown = (truePositives: number, falsePositives: number) => ({
    truePositives,
    falsePositives,
    hintsUsed: 0,
    hintPenalty: 0,
    scoreStolen: 0,
    timeBonus: 0,
  });

  it('writes each submission, its marks, and the end of the game', async () => {
    const round = await openRound({ ada: null, bob: null });

    const effect: RecordResults = {
      kind: 'record_results',
      gameId: round.gameId,
      results: [
        {
          participantId: round.participants['ada'] as string,
          marked: [1, 2],
          score: 300,
          breakdown: breakdown(2, 0),
          perfect: false,
        },
      ],
    };

    await writeResults({ db, now: () => AT }, effect);

    const standings = await selectLeaderboard(db, round.gameId);
    expect(standings.find((row) => row.guestName === 'ada')).toMatchObject({
      score: 300,
      truePositives: 2,
    });

    // The `answer` table has never held a multiplayer row: the marks were
    // graded and discarded. This is that closed.
    const marks = await selectAnswers(db, round.participants['ada'] as string);
    expect(marks.map((row) => row.paragraphIndex)).toEqual([1, 2]);
  });

  it('leaves a player who never submitted untouched', async () => {
    // The effect carries nobody who did not answer, so nothing here should
    // write them a zero — `participant_score_with_submission` would refuse it,
    // and a profile would have counted it as a round they finished.
    const round = await openRound({ ada: null, bob: null });

    await writeResults(
      { db, now: () => AT },
      {
        kind: 'record_results',
        gameId: round.gameId,
        results: [
          {
            participantId: round.participants['ada'] as string,
            marked: [1],
            score: 150,
            breakdown: breakdown(1, 0),
            perfect: false,
          },
        ],
      },
    );

    const standings = await selectLeaderboard(db, round.gameId);

    expect(standings.find((row) => row.guestName === 'bob')).toMatchObject({
      score: null,
    });
  });

  it('moves the statistics of a player who has an account', async () => {
    /*
     * The point of the whole step, asserted on the one path that can reach it
     * today: `createGame` accepts a `userId` and `apps/realtime` does not yet
     * pass one — that is E.3b.2 — so this opens the round with an account
     * directly and proves the rest of the wire is connected.
     *
     * `recordSubmission` carries the `player_stats` increment inside its own
     * transaction, so what is being checked is that multiplayer goes through
     * the same door solo does rather than a second one beside it.
     */
    const round = await openRound({ ada: 'ada-account', bob: null });

    await writeResults(
      { db, now: () => AT },
      {
        kind: 'record_results',
        gameId: round.gameId,
        results: [
          {
            participantId: round.participants['ada'] as string,
            marked: [1, 2, 3],
            score: 450,
            breakdown: breakdown(3, 0),
            perfect: true,
          },
        ],
      },
    );

    expect(await selectPlayerStats(db, 'ada-account')).toMatchObject({
      gamesPlayed: 1,
      gamesFinished: 1,
      gamesAbandoned: 0,
      falsificationsFound: 3,
      falsificationsMissed: 0,
      bestScore: 450,
      currentStreak: 1,
    });

    // D4 — and the round is over. `ended_at` was null for every multiplayer
    // game ever played, so the history said none of them had ever finished.
    const [played] = await selectGameHistory(db, 'ada-account');
    expect(played).toMatchObject({ endedAt: AT, submittedAt: AT, score: 450 });
  });
});
