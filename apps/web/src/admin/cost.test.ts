// What the model has cost — step I.6, against a real Postgres.
//
// Three claims carry these cases, and each is a way the figure could quietly
// lie:
//
//   - **a rate must be complete or absent**, because half a rate reports a cost
//     missing its dearer half;
//   - **a cached game costs nothing**, so averaging it in makes generation look
//     cheaper than it is — C4.6's insistence, carried through;
//   - **a call that reported no tokens is counted**, because `sum` skips a null
//     and a provider that stopped reporting would make the totals fall while
//     the spend rose.
import { game, llmCall, participant, user } from '@wikifake/db';
import { MS_PER_DAY } from '@wikifake/domain';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { rateFrom, readCost, spendOf, COST_DAYS } from './cost.js';
import { openWebTestDatabase, webTestDatabaseUrl } from '../testing/database.js';
import type { TestDatabase } from '@wikifake/db/testing';

const url = webTestDatabaseUrl();
const NOW = Date.UTC(2026, 8, 11, 12, 0, 0);

describe('I.6 — pricing tokens', () => {
  const tokens = { inputTokens: 2_000_000, outputTokens: 1_000_000 };

  it('is null when neither rate is configured', () => {
    // Nobody has said what a token costs is not "the model was free".
    expect(spendOf(tokens, undefined, undefined)).toBeNull();
  });

  it('is null when only one rate is configured', () => {
    // Half a rate reports a cost missing its larger half — output tokens are
    // the dearer side on every provider — and a number wrong by a factor is
    // worse than an absent one, because it looks like an answer.
    expect(spendOf(tokens, 0.3, undefined)).toBeNull();
    expect(spendOf(tokens, undefined, 2.5)).toBeNull();
  });

  it('multiplies per million, which is how providers publish it', () => {
    // Two million in at 0.30, one million out at 2.50.
    expect(spendOf(tokens, 0.3, 2.5)).toBeCloseTo(0.6 + 2.5, 6);
  });

  it('prices nothing as nothing, which is a real zero', () => {
    expect(spendOf({ inputTokens: 0, outputTokens: 0 }, 0.3, 2.5)).toBe(0);
  });
});

describe('I.6 — reading a rate out of the environment', () => {
  it('reads a number', () => {
    expect(rateFrom('0.30')).toBe(0.3);
    expect(rateFrom('2.5')).toBe(2.5);
    expect(rateFrom('0')).toBe(0);
  });

  it('treats an empty variable as no rate, not as a rate of nothing', () => {
    // `Number('')` is 0, which is the one wrong answer available: it prices the
    // model at nothing and reports a spend of zero, which looks like an
    // unusually cheap month rather than a variable nobody set.
    expect(rateFrom('')).toBeUndefined();
    expect(rateFrom('   ')).toBeUndefined();
    expect(rateFrom(undefined)).toBeUndefined();
  });

  it('refuses anything that is not a non-negative number', () => {
    expect(rateFrom('cheap')).toBeUndefined();
    expect(rateFrom('-1')).toBeUndefined();
    expect(rateFrom('Infinity')).toBeUndefined();
  });
});

describe.skipIf(url === null)('I.6 — what the model has cost', () => {
  let store: TestDatabase;
  let seats = 0;

  beforeAll(async () => {
    store = await openWebTestDatabase();
  });

  beforeEach(async () => {
    await store.truncate();
    seats = 0;
  });

  afterAll(async () => {
    await store.close();
  });

  async function round(
    over: { cached?: boolean; players?: number } = {},
  ): Promise<string> {
    const [row] = await store.db
      .insert(game)
      .values({
        mode: 'solo',
        topic: 'Chat',
        sourceUrl: 'https://fr.wikipedia.org/wiki/Chat',
        paragraphs: ['un'],
        totalFakes: 1,
        timeLimit: 300,
        fromCache: over.cached ?? false,
      })
      .returning({ id: game.id });
    const gameId = (row as { id: string }).id;

    for (let at = 0; at < (over.players ?? 1); at += 1) {
      seats += 1;
      const id = `p${String(seats)}`;
      await store.db
        .insert(user)
        .values({ id, name: id, email: `${id}@example.test`, emailVerified: false });
      await store.db
        .insert(participant)
        .values({ gameId, userId: id, colour: '#1f574d' });
    }

    return gameId;
  }

  async function call(over: {
    inputTokens?: number | null;
    outputTokens?: number | null;
    failed?: boolean;
    kind?: 'topic_choice' | 'falsification' | 'flag_verification';
    atMs?: number;
  }): Promise<void> {
    await store.db.insert(llmCall).values({
      model: 'a-model',
      kind: over.kind ?? 'falsification',
      inputTokens: over.inputTokens === undefined ? 1000 : over.inputTokens,
      outputTokens: over.outputTokens === undefined ? 500 : over.outputTokens,
      promptChars: 100,
      outputChars: 50,
      failed: over.failed ?? false,
      createdAt: new Date(over.atMs ?? NOW),
    });
  }

  const read = (rates: { input?: number; output?: number } = {}) =>
    readCost(
      {
        db: store.db,
        inputCostPerMTok: rates.input,
        outputCostPerMTok: rates.output,
      },
      NOW,
    );

  it('reports tokens and no money when no rate is set', async () => {
    await round();
    await call({});

    const view = await read();

    expect(view.totals.inputTokens).toBe(1000);
    expect(view.spend).toBeNull();
    expect(view.perGame).toBeNull();
    // Tokens per game needs no rate, so it is always there.
    expect(view.tokensPerGame).toBe(1500);
  });

  it('divides by games generated, not games served', async () => {
    // C4.6: a cached game costs nothing, and averaging it in makes generation
    // look cheaper than it is.
    await round({ cached: false });
    await round({ cached: true });
    await call({ inputTokens: 1000, outputTokens: 1000 });

    const view = await read({ input: 1, output: 1 });

    expect(view.totals.gamesGenerated).toBe(1);
    expect(view.perGame).toBeCloseTo(0.002, 9);
  });

  it('counts a failed call, because it still spent tokens', async () => {
    await round();
    await call({ failed: true, inputTokens: 4000, outputTokens: 0 });

    const view = await read({ input: 1, output: 1 });

    expect(view.totals.failed).toBe(1);
    expect(view.totals.inputTokens).toBe(4000);
    expect(view.spend).toBeCloseTo(0.004, 9);
  });

  it('says how many calls reported no token count', async () => {
    // `sum` skips a null, so a provider that stopped reporting would make the
    // totals fall while the spend rose. Counted, so the panel can say so.
    await round();
    await call({ inputTokens: 1000, outputTokens: 500 });
    await call({ inputTokens: null, outputTokens: null });

    const view = await read();

    expect(view.totals.calls).toBe(2);
    expect(view.totals.withoutTokens).toBe(1);
    expect(view.totals.inputTokens).toBe(1000);
  });

  it('counts every seat as a player, guests included', async () => {
    // The model was called for their round too, so leaving them out would
    // divide a real cost by a smaller population and flatter the figure.
    await round({ players: 3 });
    await call({ inputTokens: 3_000_000, outputTokens: 0 });

    const view = await read({ input: 1, output: 1 });

    expect(view.totals.players).toBe(3);
    expect(view.perPlayer).toBeCloseTo(1, 9);
  });

  it('groups by kind, so the expensive half of a round is visible', async () => {
    await round();
    await call({ kind: 'topic_choice', inputTokens: 100, outputTokens: 10 });
    await call({ kind: 'falsification', inputTokens: 5000, outputTokens: 4000 });
    await call({ kind: 'falsification', inputTokens: 5000, outputTokens: 4000 });

    const view = await read();
    const falsification = view.byKind.find((kind) => kind.kind === 'falsification');

    // The enum's declaration order, which Postgres sorts by — and it is the
    // order a round calls them in, rather than alphabetical.
    expect(view.byKind.map((kind) => kind.kind)).toEqual([
      'topic_choice',
      'falsification',
    ]);
    expect(falsification?.calls).toBe(2);
    expect(falsification?.outputTokens).toBe(8000);
  });

  it('reports a day per day, in UTC and oldest first', async () => {
    await round();
    await call({ atMs: NOW - MS_PER_DAY });
    await call({ atMs: NOW });
    await call({ atMs: NOW });

    const view = await read();

    expect(view.days.map((day) => day.day)).toEqual(['2026-09-10', '2026-09-11']);
    expect(view.days[1]?.calls).toBe(2);
  });

  it('leaves out a day older than the window', async () => {
    await round();
    await call({ atMs: NOW - (COST_DAYS + 1) * MS_PER_DAY });
    await call({ atMs: NOW });

    expect((await read()).days).toHaveLength(1);
  });

  it('answers nothing rather than dividing by nothing', async () => {
    await call({});

    const view = await read({ input: 1, output: 1 });

    expect(view.totals.gamesGenerated).toBe(0);
    expect(view.perGame).toBeNull();
    expect(view.perPlayer).toBeNull();
    expect(view.tokensPerGame).toBeNull();
    // The spend itself is real: the call happened.
    expect(view.spend).toBeGreaterThan(0);
  });
});
