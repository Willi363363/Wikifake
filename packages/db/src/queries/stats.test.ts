// The aggregate a profile reads — step E.4, against a real Postgres.
//
// The suite turns on one property: **the incremental path and the recomputation
// agree.** Every case plays a sequence of rounds through `createGame` and
// `recordSubmission`, reads the row the increments built, then rebuilds it from
// the `participant` rows and asserts the two are identical.
//
// That is what makes the fast path trustworthy. The plan forbids recomputing on
// a page load, so the counters are what a profile shows — and a counter nobody
// checks against its own inputs is a number that drifts once and then lies for
// ever. `attachGuestRecords` needs the slow path anyway, so it costs nothing to
// have and everything to skip.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { attachGuestRecords } from './history.js';
import { recordSubmission } from './session.js';
import { createGame } from './start.js';
import { recomputePlayerStats, selectPlayerStats } from './stats.js';
import { user } from '../schema/auth.js';
import { playerStats } from '../schema/stats.js';
import { openTestDatabase, testDatabaseUrl } from '../testing/database.js';
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

describe.skipIf(url === null)('E.4 — what a player has done', () => {
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

  const addUser = async (id: string, anonymous = false): Promise<void> => {
    await store.db.insert(user).values({
      id,
      name: id,
      email: `${id}@example.test`,
      isAnonymous: anonymous,
    });
  };

  /** Every round `startRound` builds hides this many falsifications. */
  const FAKES_PER_ROUND = 3;

  interface Round {
    readonly gameId: string;
    readonly participantId: string;
  }

  /** A three-falsification round, joined by one account. */
  const startRound = async (userId: string, topic = 'Chat'): Promise<Round> => {
    const started = await createGame(store.db, {
      mode: 'solo',
      topic,
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
      players: [{ userId, colour: '#000000' }],
    });
    return {
      gameId: started.gameId,
      participantId: started.participantIds[0] as string,
    };
  };

  /**
   * Finishes a round with a given outcome, **now**.
   *
   * The clock is the wall clock rather than a fixture's, and that is the
   * correction the equality assertion forced. `createGame` takes `startedAt`
   * from the database's `now()`, so a fixture that submitted at a made-up time
   * put a submission before the start of the round after it — and the
   * recomputation, which reads `lastSeen` as the latest thing that happened,
   * disagreed with the increments, which read it as the latest thing written.
   *
   * In production the two orderings are the same one. Here they are only the
   * same if the fixture keeps them so, and each call is a round trip apart, so
   * the timestamps are distinct and in order without being invented.
   */
  const finish = async (
    round: Round,
    outcome: { truePositives: number; falsePositives: number; score: number },
  ): Promise<void> => {
    await recordSubmission(store.db, {
      gameId: round.gameId,
      participantId: round.participantId,
      marked: [],
      score: outcome.score,
      truePositives: outcome.truePositives,
      falsePositives: outcome.falsePositives,
      hintsUsed: 0,
      hintPenalty: 0,
      scoreStolen: 0,
      timeBonus: 0,
      // The rule, asked here exactly as `apps/web` asks it before calling this
      // — and asked again, independently, by the rebuild in `bothPaths`. The
      // equality those two are held to is therefore also a check that the
      // boundary was crossed the same way in both directions.
      perfect: perfectRound({ ...outcome, totalFakes: FAKES_PER_ROUND }),
      at: new Date(),
    });
  };

  /** The row as the increments built it, beside the row a rebuild produces. */
  const bothPaths = async (userId: string) => {
    const incremental = await selectPlayerStats(store.db, userId);
    await recomputePlayerStats(store.db, userId, perfectRound);
    const recomputed = await selectPlayerStats(store.db, userId);
    return { incremental, recomputed };
  };

  it('counts a round as joined before it is finished', async () => {
    await addUser('ada');
    await startRound('ada');

    const stats = await selectPlayerStats(store.db, 'ada');

    expect(stats).toMatchObject({
      gamesPlayed: 1,
      gamesFinished: 0,
      // The number the plan asks for, and the reason "played" is counted at the
      // start: counted only on submission, these two would be one column twice.
      gamesAbandoned: 1,
      bestScore: null,
      averageScore: null,
    });
  });

  it('has no row at all for an account that has never played', async () => {
    await addUser('ada');

    // The right amount of storage for what somebody has done. A profile shows
    // "no games yet" from a null, not from a row of zeroes it cannot tell from
    // a player who lost every round.
    expect(await selectPlayerStats(store.db, 'ada')).toBeNull();
  });

  it('sums the outcomes of the rounds that were finished', async () => {
    await addUser('ada');
    await finish(await startRound('ada'), {
      truePositives: 2,
      falsePositives: 1,
      score: 220,
    });
    await finish(await startRound('ada'), {
      truePositives: 3,
      falsePositives: 0,
      score: 450,
    });

    const { incremental, recomputed } = await bothPaths('ada');

    expect(incremental).toMatchObject({
      gamesPlayed: 2,
      gamesFinished: 2,
      gamesAbandoned: 0,
      falsificationsFound: 5,
      // Three per round, two found in the first: one missed.
      falsificationsMissed: 1,
      paragraphsWronglyMarked: 1,
      bestScore: 450,
      averageScore: 335,
      // Five of the six that were there. Wrongly marked paragraphs are not in
      // the denominator: this is "how many did they see", and what a wrong mark
      // costs is the score.
      accuracy: 5 / 6,
    });
    expect(recomputed).toEqual(incremental);
  });

  it('keeps a negative score, and averages it', async () => {
    // C2.3 does not clamp a score, and neither does this: a player who marks
    // everything and buys every reveal has earned a negative average, and
    // hiding it behind a zero would hide the cost of the items too.
    await addUser('ada');
    await finish(await startRound('ada'), {
      truePositives: 0,
      falsePositives: 4,
      score: -320,
    });

    const { incremental, recomputed } = await bothPaths('ada');

    expect(incremental?.bestScore).toBe(-320);
    expect(incremental?.averageScore).toBe(-320);
    expect(recomputed).toEqual(incremental);
  });

  describe('the streak', () => {
    it('counts consecutive perfect rounds and remembers the longest', async () => {
      await addUser('ada');
      const perfect = { truePositives: 3, falsePositives: 0, score: 450 };
      const flawed = { truePositives: 3, falsePositives: 1, score: 370 };

      await finish(await startRound('ada'), perfect);
      await finish(await startRound('ada'), perfect);
      await finish(await startRound('ada'), flawed);
      await finish(await startRound('ada'), perfect);

      const { incremental, recomputed } = await bothPaths('ada');

      expect(incremental).toMatchObject({ currentStreak: 1, bestStreak: 2 });
      expect(recomputed).toEqual(incremental);
    });

    it('is broken by a true paragraph marked, not only by one missed', async () => {
      // The half that keeps it honest. Marking every paragraph finds every
      // falsification, and a streak that ignored false positives would rank the
      // players who never read.
      await addUser('ada');

      await finish(await startRound('ada'), {
        truePositives: 3,
        falsePositives: 1,
        score: 370,
      });

      const { incremental, recomputed } = await bothPaths('ada');

      expect(incremental).toMatchObject({ currentStreak: 0, bestStreak: 0 });
      expect(recomputed).toEqual(incremental);
    });

    it('is not broken by a round still in flight', async () => {
      // An unfinished round has no outcome yet. Counting it as a failure would
      // break a streak the player has not lost — and would make the two paths
      // disagree the moment somebody opened their profile mid-round.
      await addUser('ada');
      const perfect = { truePositives: 3, falsePositives: 0, score: 450 };

      await finish(await startRound('ada'), perfect);
      await startRound('ada');

      const { incremental, recomputed } = await bothPaths('ada');

      expect(incremental).toMatchObject({
        gamesPlayed: 2,
        gamesFinished: 1,
        gamesAbandoned: 1,
        currentStreak: 1,
      });
      expect(recomputed).toEqual(incremental);
    });
  });

  it('is rebuilt rather than added when a guest signs up', async () => {
    /*
     * The case the increments cannot express, and the reason the slow path
     * exists at all.
     *
     * The rounds are interleaved so that **no arithmetic over the two rows can
     * produce the right answer**. Neither a sum nor a maximum of what each side
     * holds gives `(best 3, current 0)`; only replaying one ordering does.
     */
    await addUser('ada');
    await addUser('guest', true);
    const perfect = { truePositives: 3, falsePositives: 0, score: 450 };
    const flawed = { truePositives: 3, falsePositives: 1, score: 370 };

    await finish(await startRound('guest'), perfect);
    await finish(await startRound('ada'), perfect);
    await finish(await startRound('guest'), perfect);
    await finish(await startRound('ada'), flawed);

    // Before: two rows that know nothing about each other. Ada's perfect round
    // is followed, in her own sequence, by a flawed one — so her streak is
    // spent. The guest's two are consecutive.
    expect(await selectPlayerStats(store.db, 'ada')).toMatchObject({
      bestStreak: 1,
      currentStreak: 0,
    });
    expect(await selectPlayerStats(store.db, 'guest')).toMatchObject({
      bestStreak: 2,
      currentStreak: 2,
    });

    await attachGuestRecords(store.db, 'guest', 'ada', perfectRound);

    const merged = await selectPlayerStats(store.db, 'ada');
    expect(merged).toMatchObject({
      gamesPlayed: 4,
      gamesFinished: 4,
      falsificationsFound: 12,
      // Three perfect rounds in a row across the two identities — longer than
      // either side held — and then a flawed one, so the current streak is
      // zero. A maximum would have said 2, and a sum 3 and 2. Both are wrong.
      bestStreak: 3,
      currentStreak: 0,
    });
  });

  it('does not attribute a round nobody signed in for', async () => {
    // Multiplayer creates participants with a nickname and no `userId`, and
    // this is what stops that becoming a stats row belonging to nobody. It is
    // also the assertion that will change when E.3b lands.
    await createGame(store.db, {
      mode: 'multiplayer',
      roomCode: null,
      topic: 'Chat',
      sourceUrl: 'https://fr.wikipedia.org/wiki/Chat',
      paragraphs: ['un', 'deux'],
      timeLimit: 300,
      fromCache: false,
      solution: [
        {
          paragraphIndex: 1,
          falseInfoNumber: 1,
          falseStatement: 'faux',
          originalText: 'vrai',
          explanation: 'because',
          hint: 'a hint',
        },
      ],
      players: [{ guestName: 'bob', colour: '#2a9d8f' }],
    });

    const rows = await store.db.select().from(playerStats);
    expect(rows).toEqual([]);
  });
});
