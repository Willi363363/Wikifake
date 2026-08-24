// 3.7 — a generation, and what it left in the ledger.
//
// This is the one test that puts the two halves together: `@wikifake/article`
// produces the call records, this package stores them, and `usageReport` reads
// them back. It lives here, with the other integration tests, because this
// package owns the database — one truncation policy, one file at a time. The
// dependency on `article` is a **devDependency**: the data flows from the
// generator into the schema, never the other way, and `workspace-graph.test.ts`
// holds that arrow.
import { generateArticle, type GenerationReport } from '@wikifake/article';
import type { LanguageModel } from 'ai';
import { MockLanguageModelV4 } from 'ai/test';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { game } from '../schema/game.js';
import { llmCall } from '../schema/usage.js';
import { readUsageTotals, recordLlmCalls, usageReport } from './usage.js';
import {
  openTestDatabase,
  testDatabaseUrl,
  type TestDatabase,
} from '../testing/database.js';

const url = testDatabaseUrl();

/** Three paragraphs long enough to falsify. Shorter and the generator refuses. */
const HTML = `<div>${[1, 2, 3]
  .map(
    (n) =>
      `<p>Paragraphe ${String(n)} : ${'du texte encyclopédique bien assez long pour être falsifié. '.repeat(3)}</p>`,
  )
  .join('')}</div>`;

const OPTIONS = {
  html: HTML,
  topic: 'Chocolat',
  sourceUrl: 'https://fr.wikipedia.org/wiki/Chocolat',
  seed: 7,
  falsificationCount: 2,
};

/** A model that falsifies what it is offered, and reports what it spent. */
function working(): LanguageModel {
  return new MockLanguageModelV4({
    doGenerate: async (options) => {
      const sent = JSON.stringify(options.prompt);
      const offered = [...sent.matchAll(/paragraph_index\\?":\s*(\d+)/g)].map((match) =>
        Number(match[1]),
      );
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              falsifications: offered.map((index) => ({
                paragraphIndex: index,
                swappedText: `FAUX-${String(index)} un fait inventé mais crédible.`,
                explanation: `La vérité sur ${String(index)}.`,
                hint: `Vérifiez le paragraphe ${String(index)}.`,
              })),
            }),
          },
        ],
        finishReason: { unified: 'stop' as const, raw: undefined },
        usage: {
          inputTokens: {
            total: 3000,
            noCache: 3000,
            cacheRead: undefined,
            cacheWrite: undefined,
          },
          outputTokens: { total: 600, text: 600, reasoning: undefined },
        },
        warnings: [],
      };
    },
  });
}

/** A model that is down. The call still happened, and still has to be recorded. */
function broken(): LanguageModel {
  return new MockLanguageModelV4({
    doGenerate: async () => {
      throw new Error('the provider is down');
    },
  });
}

describe.skipIf(url === null)('3.7 — every call lands in the ledger', () => {
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

  /** Persists a report the way a caller will: a game only if there was one. */
  async function persist(report: GenerationReport): Promise<string | null> {
    if (!report.result.ok) {
      // C4.5 — no game row, so the failure cannot enter `perGeneratedGame`. The
      // calls are recorded all the same: they cost money.
      await recordLlmCalls(store.db, report.calls, null);
      return null;
    }

    const [row] = await store.db
      .insert(game)
      .values({
        mode: 'solo',
        topic: report.result.value.article.topic,
        sourceUrl: report.result.value.article.wikipediaUrl,
        paragraphs: report.result.value.article.paragraphs,
        totalFakes: report.result.value.article.totalFakes,
        timeLimit: 300,
        fromCache: false,
      })
      .returning({ id: game.id });

    const gameId = row?.id ?? null;
    await recordLlmCalls(store.db, report.calls, gameId);
    return gameId;
  }

  it('carries both rows after one success and one failure', async () => {
    const success = await generateArticle({ ...OPTIONS, model: working() });
    const failure = await generateArticle({ ...OPTIONS, model: broken() });

    expect(success.result.ok).toBe(true);
    expect(failure.result.ok).toBe(false);

    const gameId = await persist(success);
    expect(await persist(failure)).toBeNull();

    const rows = await store.db.select().from(llmCall);
    expect(rows).toHaveLength(2);

    const succeeded = rows.find((row) => !row.failed);
    const failed = rows.find((row) => row.failed);

    expect(succeeded).toMatchObject({
      kind: 'falsification',
      gameId,
      inputTokens: 3000,
      outputTokens: 600,
    });
    // The prompt was sent and billed even though nothing came back, so the proxy
    // count is kept while the token counts stay null — null being "the provider
    // told us nothing", which a zero would misreport as a measurement.
    expect(failed).toMatchObject({
      kind: 'falsification',
      gameId: null,
      inputTokens: null,
      outputTokens: null,
      outputChars: 0,
    });
    expect(failed?.promptChars ?? 0).toBeGreaterThan(0);
  });

  it('counts only the successful one in perGeneratedGame', async () => {
    await persist(await generateArticle({ ...OPTIONS, model: working() }));
    await persist(await generateArticle({ ...OPTIONS, model: broken() }));

    const report = usageReport(await readUsageTotals(store.db));

    // One game generated, one successful call, and the failure nowhere in it.
    expect(report.totals.llmCalls).toBe(1);
    expect(report.perGeneratedGame).toEqual({
      llmCalls: 1,
      inputTokens: 3000,
      outputTokens: 600,
    });
    expect(report.cacheHitRate).toBe(0);
  });

  // The other half of C4.6: a game served from the cache made no call, so it must
  // not dilute the cost of the games that did.
  it('does not let a cached game dilute the cost of a generated one', async () => {
    await persist(await generateArticle({ ...OPTIONS, model: working() }));

    await store.db.insert(game).values({
      mode: 'solo',
      topic: 'Chocolat',
      sourceUrl: 'https://fr.wikipedia.org/wiki/Chocolat',
      paragraphs: ['servi depuis le cache'],
      totalFakes: 1,
      timeLimit: 300,
      fromCache: true,
    });

    const report = usageReport(await readUsageTotals(store.db));

    expect(report.cacheHitRate).toBe(0.5);
    // Still one generated game, so still the full cost of one generation.
    expect(report.perGeneratedGame.inputTokens).toBe(3000);
  });

  it('writes nothing when there was no call to write', async () => {
    const report = await generateArticle({
      ...OPTIONS,
      html: '<p>trop court</p>',
      model: working(),
    });

    expect(report.calls).toEqual([]);
    await recordLlmCalls(store.db, report.calls, null);
    expect(await store.db.select().from(llmCall)).toEqual([]);
  });
});
