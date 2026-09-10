// The read path and the cron — step F.5, against a real Postgres.
//
// The track's exit gate has four lines this file can reach, and each is a case
// below rather than an inference:
//
//   - "a day passes with no human involvement and every player has a fresh set";
//   - "the cron is run twice for the same date and nothing is duplicated";
//   - "a player created at 03:00 sees quests immediately";
//   - "the quest engine is stopped entirely and a full game still plays" — the
//     half of it that can be asserted here is that the cron writes nothing the
//     read path could not, so a stopped cron costs nobody a quest.
//
// The clock is a parameter throughout, so a Thursday is a number rather than a
// wait.
import { assignQuests, selectQuestSet } from '@wikifake/db';
import {
  generateQuestSet,
  periodIndexOf,
  QUEST_CATALOGUE,
  QUESTS_PER_SET,
} from '@wikifake/domain';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { assignQuestsForActivePlayers } from './cron.js';
import { handleQuestCron } from './handler.js';
import { readLiveQuests } from './sets.js';
import { openWebTestDatabase, webTestDatabaseUrl } from '../testing/database.js';
import { game, participant, playerStats, user } from '@wikifake/db';
import type { Env } from '@wikifake/env';
import type { TestDatabase } from '@wikifake/db/testing';

const url = webTestDatabaseUrl();

/** 2026-09-10, a Thursday: day 20706, in the week that began Monday the 7th. */
const DAY = 86_400_000;
const THURSDAY = 20_706 * DAY;

describe.skipIf(url === null)('F.5 — the quests a player holds', () => {
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

  const addUser = async (id: string, lastSeenMs?: number): Promise<void> => {
    await store.db
      .insert(user)
      .values({ id, name: id, email: `${id}@example.test`, emailVerified: false });
    if (lastSeenMs !== undefined) {
      await store.db.insert(playerStats).values({
        userId: id,
        lastSeen: new Date(lastSeenMs),
        firstSeen: new Date(lastSeenMs),
      });
    }
  };

  /** A finished round for this player, at this instant. */
  const played = async (
    userId: string,
    atMs: number,
    over: { readonly truePositives?: number; readonly score?: number } = {},
  ): Promise<void> => {
    const [row] = await store.db
      .insert(game)
      .values({
        mode: 'solo',
        topic: 'Chat',
        sourceUrl: 'https://fr.wikipedia.org/wiki/Chat',
        paragraphs: ['un paragraphe'],
        totalFakes: 3,
        timeLimit: 300,
        endedAt: new Date(atMs),
      })
      .returning({ id: game.id });
    if (row === undefined) throw new Error('no game');

    await store.db.insert(participant).values({
      gameId: row.id,
      userId,
      colour: '#1f574d',
      submittedAt: new Date(atMs),
      score: over.score ?? 400,
      truePositives: over.truePositives ?? 3,
      falsePositives: 0,
      hintsUsed: 0,
      hintPenalty: 0,
      scoreStolen: 0,
      timeBonus: 0,
    });
  };

  describe('the read path is the guarantee', () => {
    it('generates a set for a player who has never had one', async () => {
      // "A player created at 03:00 sees quests immediately." Nothing has run for
      // them, and there is nothing scheduled between 03:00 and their request.
      await addUser('ada');

      const quests = await readLiveQuests(context(), 'ada', THURSDAY + 3 * 3_600_000);

      expect(quests).toHaveLength(QUESTS_PER_SET.daily + QUESTS_PER_SET.weekly);
      expect(quests.filter((one) => one.period === 'daily')).toHaveLength(
        QUESTS_PER_SET.daily,
      );
      expect(quests.filter((one) => one.period === 'weekly')).toHaveLength(
        QUESTS_PER_SET.weekly,
      );
    });

    it('writes that set down, so a second read is not a second draw', async () => {
      await addUser('ada');
      const first = await readLiveQuests(context(), 'ada', THURSDAY);
      const second = await readLiveQuests(context(), 'ada', THURSDAY);

      expect(second).toEqual(first);
      expect(await selectQuestSet(store.db, 'ada', 'daily', 20_706)).toHaveLength(
        QUESTS_PER_SET.daily,
      );
    });

    it('gives the same set the generator would have', async () => {
      // The read path must not be a second source of quests: what it stores is
      // what `generateQuestSet` draws, and nothing about the request changes it.
      await addUser('ada');
      await readLiveQuests(context(), 'ada', THURSDAY);

      const drawn = generateQuestSet('ada', 'daily', 20_706);
      const stored = await selectQuestSet(store.db, 'ada', 'daily', 20_706);

      expect([...stored].map((one) => one.ruleId).sort()).toEqual(
        [...drawn].map((one) => one.ruleId).sort(),
      );
    });

    it('reads the reward from the catalogue and the target from the row', async () => {
      // F.3's asymmetry, visible where a screen would see it.
      await addUser('ada');
      const quests = await readLiveQuests(context(), 'ada', THURSDAY);

      for (const quest of quests) {
        const rule = QUEST_CATALOGUE[quest.ruleId];
        expect(quest.reward).toBe(rule.reward);
        expect(quest.target).toBeGreaterThanOrEqual(rule.target.min);
        expect(quest.target).toBeLessThanOrEqual(rule.target.max);
        expect(quest.claimedAt).toBeNull();
      }
    });

    it('counts a round played today against today’s quests', async () => {
      await addUser('ada');
      await played('ada', THURSDAY + 3_600_000);

      const quests = await readLiveQuests(context(), 'ada', THURSDAY + 7_200_000);
      const rounds = quests.find(
        (one) => one.ruleId === 'DAILY_FINISH_ROUNDS' && one.period === 'daily',
      );

      // The rule is in the daily set or it is not — the draw decides — so this
      // asserts on whichever quests were actually given, and at least one of
      // them must have moved.
      expect(quests.some((one) => one.progress > 0)).toBe(true);
      if (rounds !== undefined) expect(rounds.progress).toBe(1);
    });

    it('leaves yesterday’s round out of today’s progress', async () => {
      await addUser('ada');
      await played('ada', THURSDAY - 3_600_000);

      const daily = (await readLiveQuests(context(), 'ada', THURSDAY)).filter(
        (one) => one.period === 'daily',
      );

      expect(daily.every((one) => one.progress === 0)).toBe(true);
    });

    it('counts it against the week, which yesterday is still inside', async () => {
      // The Wednesday before a Thursday is the same ISO week, so the two periods
      // must disagree about the same round. This is the case that would pass by
      // accident if both windows were the day.
      await addUser('ada');
      await played('ada', THURSDAY - 3_600_000);

      const quests = await readLiveQuests(context(), 'ada', THURSDAY);
      const weekly = quests.filter((one) => one.period === 'weekly');
      const daily = quests.filter((one) => one.period === 'daily');

      expect(weekly.some((one) => one.progress > 0)).toBe(true);
      expect(daily.every((one) => one.progress === 0)).toBe(true);
    });

    it('marks a quest complete once its target is met', async () => {
      await addUser('ada');
      // Enough rounds for the widest daily target in the catalogue.
      for (let index = 0; index < 12; index += 1) {
        await played('ada', THURSDAY + index * 60_000);
      }

      const daily = (await readLiveQuests(context(), 'ada', THURSDAY + DAY / 2)).filter(
        (one) => one.period === 'daily' && one.ruleId === 'DAILY_FINISH_ROUNDS',
      );

      for (const quest of daily) {
        expect(quest.progress).toBe(12);
        expect(quest.complete).toBe(true);
      }
    });

    it('keeps a target a player is already working towards', async () => {
      /*
       * The read path must not re-draw. `assignQuests` does not update on
       * conflict, so a row written by hand with an unusual target stays — which
       * is what protects a half-finished quest from a catalogue edit.
       */
      await addUser('ada');
      await assignQuests(store.db, 'ada', [
        {
          ruleId: 'DAILY_FINISH_ROUNDS',
          period: 'daily',
          periodIndex: 20_706,
          target: 99,
        },
      ]);

      const daily = (await readLiveQuests(context(), 'ada', THURSDAY)).filter(
        (one) => one.period === 'daily',
      );

      // Only the row that exists: the set is not topped up to three, because a
      // period with rows is a period that has been assigned.
      expect(daily).toHaveLength(1);
      expect(daily[0]?.target).toBe(99);
    });

    it('drops a row whose rule the catalogue no longer knows', async () => {
      // F.3 stores `rule_id` as text so a retired rule's rows survive. There is
      // no label, no tally and no reward for one, so it cannot be shown.
      await addUser('ada');
      await assignQuests(store.db, 'ada', [
        {
          ruleId: 'DAILY_RULE_THAT_WAS_RETIRED',
          period: 'daily',
          periodIndex: 20_706,
          target: 3,
        },
      ]);

      const daily = (await readLiveQuests(context(), 'ada', THURSDAY)).filter(
        (one) => one.period === 'daily',
      );

      expect(daily).toEqual([]);
    });
  });

  describe('the cron is only ever a pre-warm', () => {
    it('assigns for a player who has played recently', async () => {
      await addUser('ada', THURSDAY - DAY);

      const outcome = await assignQuestsForActivePlayers(context(), THURSDAY);

      expect(outcome.players).toBe(1);
      expect(outcome.assigned).toBe(QUESTS_PER_SET.daily + QUESTS_PER_SET.weekly);
    });

    it('writes nothing the second time it runs for the same day', async () => {
      // The exit gate, in one assertion: "the cron is run twice for the same
      // date and nothing is duplicated."
      await addUser('ada', THURSDAY - DAY);
      await assignQuestsForActivePlayers(context(), THURSDAY);

      const again = await assignQuestsForActivePlayers(context(), THURSDAY + 3_600_000);

      expect(again.assigned).toBe(0);
      expect(await selectQuestSet(store.db, 'ada', 'daily', 20_706)).toHaveLength(
        QUESTS_PER_SET.daily,
      );
    });

    it('assigns the next day’s set the next day, and only the daily one', async () => {
      // Friday is a new day inside the same week, so the daily set is new and
      // the weekly set is a conflict. That is why one schedule covers both.
      await addUser('ada', THURSDAY - DAY);
      await assignQuestsForActivePlayers(context(), THURSDAY);

      const friday = await assignQuestsForActivePlayers(context(), THURSDAY + DAY);

      expect(friday.assigned).toBe(QUESTS_PER_SET.daily);
      expect(periodIndexOf('weekly', THURSDAY)).toBe(
        periodIndexOf('weekly', THURSDAY + DAY),
      );
    });

    it('skips a player who has not played in a fortnight', async () => {
      await addUser('ada', THURSDAY - 30 * DAY);

      const outcome = await assignQuestsForActivePlayers(context(), THURSDAY);

      expect(outcome).toEqual({ players: 0, assigned: 0 });
      // And they lose nothing by it: the read path is what they get.
      expect(await readLiveQuests(context(), 'ada', THURSDAY)).toHaveLength(
        QUESTS_PER_SET.daily + QUESTS_PER_SET.weekly,
      );
    });

    it('skips a player with no stats row at all', async () => {
      // An account that has never started a round. The read path covers them.
      await addUser('ada');

      expect(await assignQuestsForActivePlayers(context(), THURSDAY)).toEqual({
        players: 0,
        assigned: 0,
      });
    });

    it('gives the cron and the read path the identical set', async () => {
      /*
       * The property that makes a stopped cron harmless, asserted rather than
       * asserted about: whichever of the two runs first, the rows are the same.
       */
      await addUser('ada', THURSDAY - DAY);
      await addUser('bob', THURSDAY - DAY);

      await assignQuestsForActivePlayers(context(), THURSDAY);
      const byCron = await selectQuestSet(store.db, 'ada', 'daily', 20_706);

      await readLiveQuests(context(), 'bob', THURSDAY);
      const byRead = await selectQuestSet(store.db, 'bob', 'daily', 20_706);

      // Different players draw different sets, so the comparison is of shape:
      // both are a full set, and each matches what the generator draws for them.
      expect(byCron).toHaveLength(QUESTS_PER_SET.daily);
      expect(byRead).toHaveLength(QUESTS_PER_SET.daily);
      expect(byCron.map((one) => one.ruleId).sort()).toEqual(
        generateQuestSet('ada', 'daily', 20_706)
          .map((one) => one.ruleId)
          .sort(),
      );
      expect(byRead.map((one) => one.ruleId).sort()).toEqual(
        generateQuestSet('bob', 'daily', 20_706)
          .map((one) => one.ruleId)
          .sort(),
      );
    });
  });

  describe('the endpoint nobody but the scheduler may call', () => {
    const handlerContext = (secret: string | undefined) => ({
      db: store.db,
      env: { CRON_SECRET: secret } as unknown as Env,
      now: () => THURSDAY,
    });

    const call = (secret: string | undefined, header?: string): Promise<Response> =>
      handleQuestCron(
        handlerContext(secret),
        new Request('http://localhost:3000/api/cron/quests', {
          method: 'POST',
          ...(header === undefined ? {} : { headers: { authorization: header } }),
        }),
      );

    it('runs for the scheduler’s own token', async () => {
      await addUser('ada', THURSDAY - DAY);

      const answer = await call(
        'a-long-enough-cron-token',
        'Bearer a-long-enough-cron-token',
      );

      expect(answer.status).toBe(200);
      expect(await answer.json()).toEqual({
        players: 1,
        assigned: QUESTS_PER_SET.daily + QUESTS_PER_SET.weekly,
      });
    });

    it('refuses when the deployment has no secret, rather than running open', async () => {
      // The line that matters most in this file. A forgotten variable must not
      // make this a public endpoint that rewrites every player's quests.
      await addUser('ada', THURSDAY - DAY);

      const answer = await call(undefined, 'Bearer anything-at-all');

      // 503 and not 401: nothing is wrong with the request, the deployment is
      // not configured, and a log has to tell those apart.
      expect(answer.status).toBe(503);
      expect(await selectQuestSet(store.db, 'ada', 'daily', 20_706)).toEqual([]);
    });

    it.each([
      ['no header at all', undefined],
      ['the wrong token', 'Bearer not-the-cron-token-at-all'],
      ['the right token, wrong scheme', 'Basic a-long-enough-cron-token'],
      ['a bare token', 'a-long-enough-cron-token'],
      ['an empty bearer', 'Bearer '],
    ])('refuses %s', async (_label, header) => {
      await addUser('ada', THURSDAY - DAY);

      const answer = await call('a-long-enough-cron-token', header);

      expect(answer.status).toBe(401);
      expect(await selectQuestSet(store.db, 'ada', 'daily', 20_706)).toEqual([]);
    });

    it('refuses a token that is a prefix of the right one', async () => {
      // The comparison checks length first, so this is the case that would pass
      // on a loop that stopped at the shorter string.
      await addUser('ada', THURSDAY - DAY);

      const answer = await call('a-long-enough-cron-token', 'Bearer a-long-enough-cron');

      expect(answer.status).toBe(401);
    });
  });
});
