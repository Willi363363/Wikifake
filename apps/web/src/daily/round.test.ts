// A round on the day's article — step N.5, against a real Postgres.
//
// The rule with teeth is "once": it is a join across two tables, so a fake would
// only prove the fake agrees with itself.
import { HTML, falsifier } from '@wikifake/article/testing';
import { game, participant, user } from '@wikifake/db';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { startDailyRound, type DailyRoundDependencies } from './round.js';
import { openWebTestDatabase, webTestDatabaseUrl } from '../testing/database.js';
import type { TestDatabase } from '@wikifake/db/testing';

const url = webTestDatabaseUrl();

/** 2026-09-10, whose day index is 20706. */
const AT = Date.UTC(2026, 8, 10, 4, 0, 0);
const DAY = 20_706;

const viewed = (...titles: string[]) => ({
  query: { mostviewed: titles.map((title) => ({ ns: 0, title })) },
});
const pageOf = (title: string, html: string) => ({
  parse: { title, revid: 1, text: html },
});

function wiki(answers: readonly unknown[]) {
  let at = 0;
  const fetch: typeof globalThis.fetch = () => {
    const body = answers[Math.min(at, answers.length - 1)];
    at += 1;
    return Promise.resolve(
      new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  };
  return { fetch };
}

describe.skipIf(url === null)('N.5 — a round on the day’s article', () => {
  let store: TestDatabase;

  const GOOD = [viewed('Chat'), pageOf('Chat', HTML)];

  const deps = (answers: readonly unknown[] = GOOD): DailyRoundDependencies => ({
    db: store.db,
    model: falsifier(),
    wiki: { language: 'fr', userAgent: 'WikiFake/2.0 (test)' },
    transport: wiki(answers),
    seed: () => 7,
  });

  const addUser = async (id: string): Promise<void> => {
    await store.db
      .insert(user)
      .values({ id, name: id, email: `${id}@example.test`, emailVerified: false });
  };

  const player = (id: string | null) => ({
    userId: id,
    guestName: id === null ? 'invité' : null,
    colour: '#1f574d',
  });

  beforeAll(async () => {
    store = await openWebTestDatabase();
  });
  beforeEach(async () => {
    await store.truncate();
  });
  afterAll(async () => {
    await store.close();
  });

  it('starts a round on the article the day already holds', async () => {
    await addUser('ada');

    const outcome = await startDailyRound(
      deps(),
      { player: player('ada'), timeLimit: 300 },
      AT,
    );

    expect(outcome.ok).toBe(true);
    expect(outcome.ok && outcome.value.topic).toBe('Chat');
    expect(outcome.ok && outcome.value.totalFakes).toBeGreaterThan(0);
  });

  it('marks the round as the day’s, so the board can find it', async () => {
    await addUser('ada');
    const outcome = await startDailyRound(
      deps(),
      { player: player('ada'), timeLimit: 300 },
      AT,
    );

    const rows = await store.db
      .select({ id: game.id, dailyDay: game.dailyDay, fromCache: game.fromCache })
      .from(game);
    const row = rows.find(
      (one) => one.id === (outcome.ok ? outcome.value.sessionId : ''),
    );

    expect(row?.dailyDay).toBe(DAY);
    // C4.6 — reused, not generated. The day paid for itself once.
    expect(row?.fromCache).toBe(true);
  });

  /*
   * The rule that makes the board mean anything. A player free to replay until
   * the score is good is ranked against their own patience rather than against
   * the others.
   */
  it('refuses a second attempt at the same day', async () => {
    await addUser('ada');
    await startDailyRound(deps(), { player: player('ada'), timeLimit: 300 }, AT);

    const again = await startDailyRound(
      deps(),
      { player: player('ada'), timeLimit: 300 },
      AT,
    );

    expect(again.ok).toBe(false);
    expect(!again.ok && again.code).toBe('daily_already_played');
  });

  it('lets the same player play the next day', async () => {
    await addUser('ada');
    await startDailyRound(deps(), { player: player('ada'), timeLimit: 300 }, AT);

    const tomorrow = await startDailyRound(
      { ...deps([viewed('Lyon'), pageOf('Lyon', HTML)]) },
      { player: player('ada'), timeLimit: 300 },
      AT + 86_400_000,
    );

    expect(tomorrow.ok).toBe(true);
    expect(tomorrow.ok && tomorrow.value.topic).toBe('Lyon');
  });

  it('does not spend one player’s attempt on another’s round', async () => {
    await addUser('ada');
    await addUser('grace');
    await startDailyRound(deps(), { player: player('ada'), timeLimit: 300 }, AT);

    const grace = await startDailyRound(
      deps(),
      { player: player('grace'), timeLimit: 300 },
      AT,
    );

    expect(grace.ok).toBe(true);
  });

  /*
   * Two players, one article — the promise of the whole track, held here rather
   * than assumed from N.3. The sentences are compared, not the topic.
   */
  it('gives two players the same falsified paragraphs', async () => {
    await addUser('ada');
    await addUser('grace');

    const first = await startDailyRound(
      deps(),
      { player: player('ada'), timeLimit: 300 },
      AT,
    );
    const second = await startDailyRound(
      // A transport that would fail if it were used at all.
      deps([{ query: { mostviewed: [] } }]),
      { player: player('grace'), timeLimit: 300 },
      AT,
    );

    expect(first.ok && second.ok).toBe(true);
    if (first.ok && second.ok) {
      expect(second.value.paragraphs).toEqual(first.value.paragraphs);
      expect(second.value.totalFakes).toBe(first.value.totalFakes);
    }
  });

  /*
   * A guest has no identity to spend an attempt with. Asserted rather than left
   * implicit: it is a hole, and a hole nobody wrote down is a hole somebody
   * rediscovers as a bug.
   */
  it('does not stop a guest, because a guest has no attempt to use', async () => {
    await startDailyRound(deps(), { player: player(null), timeLimit: 300 }, AT);
    const again = await startDailyRound(
      deps(),
      { player: player(null), timeLimit: 300 },
      AT,
    );

    expect(again.ok).toBe(true);
  });

  it('says the day is not ready rather than failing, when nothing can be made', async () => {
    await addUser('ada');

    const outcome = await startDailyRound(
      deps([{ query: { mostviewed: [] } }, { query: { random: [] } }]),
      { player: player('ada'), timeLimit: 300 },
      AT,
    );

    expect(outcome.ok).toBe(false);
    expect(!outcome.ok && outcome.code).toBe('daily_not_ready');
  });

  it('leaves no round behind when the day is not ready', async () => {
    await addUser('ada');
    await startDailyRound(
      deps([{ query: { mostviewed: [] } }, { query: { random: [] } }]),
      { player: player('ada'), timeLimit: 300 },
      AT,
    );

    expect(await store.db.select().from(participant)).toHaveLength(0);
  });
});
