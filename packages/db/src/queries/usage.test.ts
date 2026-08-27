import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  openTestDatabase,
  rejectionCode,
  SQLSTATE,
  testDatabaseUrl,
  type TestDatabase,
} from '../testing/database.js';
import { game, llmCall } from '../schema/index.js';
import {
  readUsageTotals,
  selectCallsByKind,
  selectCostOfGame,
  selectFailuresByKind,
  usageReport,
} from './usage.js';

const url = testDatabaseUrl();

const ARTICLE = {
  topic: 'Paris',
  sourceUrl: 'https://fr.wikipedia.org/wiki/Paris',
  paragraphs: ['un', 'deux'],
  totalFakes: 1,
  timeLimit: 300,
} as const;

describe('the cost of a game, without a database', () => {
  // The arithmetic, pinned before any SQL is involved. Rounding and division by
  // zero are the two things this gets wrong if it gets anything wrong.
  it('divides by games generated, not by games served', () => {
    const report = usageReport({
      calls: 24,
      inputTokens: 22_000,
      outputTokens: 4_800,
      gamesGenerated: 12,
      gamesFromCache: 30,
    });
    expect(report.perGeneratedGame).toEqual({
      llmCalls: 2,
      inputTokens: 1833.3,
      outputTokens: 400,
    });
    // 30 of 42 served came from the cache.
    expect(report.cacheHitRate).toBe(0.714);
  });

  // C4.6 — the whole point of "not diluted by the cache": the cost of
  // generating is what it costs to generate, however many hits came free.
  it('does not let cache hits make generation look cheaper', () => {
    const spend = { calls: 24, inputTokens: 22_000, outputTokens: 4_800 };
    const few = usageReport({ ...spend, gamesGenerated: 12, gamesFromCache: 0 });
    const many = usageReport({ ...spend, gamesGenerated: 12, gamesFromCache: 1_000 });
    expect(many.perGeneratedGame).toEqual(few.perGeneratedGame);
    expect(many.cacheHitRate).toBeGreaterThan(few.cacheHitRate);
  });

  it('answers zero before the first generation rather than dividing by it', () => {
    const report = usageReport({
      calls: 3,
      inputTokens: 100,
      outputTokens: 20,
      gamesGenerated: 0,
      gamesFromCache: 0,
    });
    expect(report.perGeneratedGame).toEqual({
      llmCalls: 0,
      inputTokens: 0,
      outputTokens: 0,
    });
    expect(report.cacheHitRate).toBe(0);
  });

  it('reports a full cache hit rate when nothing was generated but games were served', () => {
    const report = usageReport({
      calls: 0,
      inputTokens: 0,
      outputTokens: 0,
      gamesGenerated: 0,
      gamesFromCache: 5,
    });
    expect(report.cacheHitRate).toBe(1);
  });
});

describe.skipIf(url === null)('the cost of a game, on data', () => {
  let database: TestDatabase;

  beforeAll(async () => {
    database = await openTestDatabase(url as string);
  });
  afterAll(async () => {
    await database.close();
  });
  beforeEach(async () => {
    await database.truncate();
  });

  /**
   * Two generated games and one served from the cache, with a topic choice and
   * a falsification each — plus one falsification that failed.
   */
  async function seed(): Promise<{ firstGameId: string }> {
    const { db } = database;

    const generated = await db
      .insert(game)
      .values([
        { ...ARTICLE, mode: 'solo', fromCache: false },
        { ...ARTICLE, mode: 'multiplayer', fromCache: false },
      ])
      .returning({ id: game.id });
    await db.insert(game).values({ ...ARTICLE, mode: 'solo', fromCache: true });

    const call = { model: 'gemini-3.1-flash-lite', promptChars: 4_000, outputChars: 800 };
    await db.insert(llmCall).values([
      {
        ...call,
        gameId: generated[0]?.id,
        kind: 'topic_choice',
        inputTokens: 500,
        outputTokens: 40,
      },
      {
        ...call,
        gameId: generated[0]?.id,
        kind: 'falsification',
        inputTokens: 5_000,
        outputTokens: 900,
      },
      {
        ...call,
        gameId: generated[1]?.id,
        kind: 'topic_choice',
        inputTokens: 500,
        outputTokens: 40,
      },
      {
        ...call,
        gameId: generated[1]?.id,
        kind: 'falsification',
        inputTokens: 5_000,
        outputTokens: 900,
      },
      // C4.5 — a failure. It bought nothing and never became a game.
      {
        ...call,
        kind: 'falsification',
        inputTokens: 9_999_999,
        outputTokens: 9_999_999,
        failed: true,
      },
    ]);

    return { firstGameId: generated[0]?.id as string };
  }

  it('returns the expected aggregate', async () => {
    await seed();
    const totals = await readUsageTotals(database.db);

    expect(totals).toEqual({
      calls: 4,
      inputTokens: 11_000,
      outputTokens: 1_880,
      gamesGenerated: 2,
      gamesFromCache: 1,
    });

    const report = usageReport(totals);
    expect(report.perGeneratedGame).toEqual({
      llmCalls: 2,
      inputTokens: 5_500,
      outputTokens: 940,
    });
    expect(report.cacheHitRate).toBe(0.333);
  });

  // The criterion, stated as its own test: the failure carries absurd token
  // counts precisely so that including it would be impossible to miss.
  it('C4.5 — a failed call does not enter perGeneratedGame', async () => {
    await seed();
    const report = usageReport(await readUsageTotals(database.db));
    expect(report.perGeneratedGame.inputTokens).toBe(5_500);
    expect(report.totals.inputTokens).toBe(11_000);
  });

  it('counts the failure separately, because a failure rate is its own signal', async () => {
    await seed();
    expect(await selectFailuresByKind(database.db)).toEqual([
      { kind: 'falsification', failures: 1 },
    ]);
  });

  it('breaks the spend down by kind', async () => {
    await seed();
    const byKind = await selectCallsByKind(database.db);
    expect(Object.fromEntries(byKind.map((row) => [row.kind, row.calls]))).toEqual({
      topic_choice: 2,
      falsification: 2,
    });
  });

  it('answers what one game cost', async () => {
    const { firstGameId } = await seed();
    const [cost] = await selectCostOfGame(database.db, firstGameId);
    expect(cost).toEqual({ calls: 2, inputTokens: 5_500, outputTokens: 940 });
  });

  // The model does not always report usage; the character counts are the proxy
  // `usage.py` already falls back on, and a null says "not measured" where a
  // zero would look like a measurement.
  it('accepts a call whose token usage the model did not report', async () => {
    await database.db.insert(llmCall).values({
      model: 'gemini-3.1-flash-lite',
      kind: 'topic_choice',
      promptChars: 100,
      outputChars: 20,
    });
    const [row] = await database.db.select().from(llmCall);
    expect(row?.inputTokens).toBe(null);
    expect(row?.promptChars).toBe(100);
  });

  it('refuses a negative token count', async () => {
    const code = await rejectionCode(
      database.db.insert(llmCall).values({
        model: 'gemini-3.1-flash-lite',
        kind: 'topic_choice',
        inputTokens: -1,
        promptChars: 100,
        outputChars: 20,
      }),
    );
    expect(code).toBe(SQLSTATE.checkViolation);
  });

  // A game is deleted, its cost is not: what was spent was spent.
  it('keeps the spend when the game goes', async () => {
    await seed();
    await database.db.delete(game);
    const totals = await readUsageTotals(database.db);
    expect(totals.calls).toBe(4);
    expect(totals.gamesGenerated).toBe(0);
  });
});
