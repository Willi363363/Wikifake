// The day's article, on demand — step N.3, against a real Postgres.
//
// The claim is a database statement, so every case that matters here is one: a
// fake would only prove the fake agrees with itself. Wikipedia and the model are
// injected, so no test touches the network.
import { claimDay, llmCall, selectDay } from '@wikifake/db';
import { HTML, falsifier, refuser } from '@wikifake/article/testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { ensureDailyArticle, type DailyDependencies } from './article.js';
import { openWebTestDatabase, webTestDatabaseUrl } from '../testing/database.js';
import type { TestDatabase } from '@wikifake/db/testing';

const url = webTestDatabaseUrl();

/** 2026-09-10, whose day index is 20706. */
const AT = Date.UTC(2026, 8, 10, 4, 0, 0);
const DAY = 20_706;

const viewed = (...titles: string[]) => ({
  query: { mostviewed: titles.map((title) => ({ ns: 0, title })) },
});
const page = (title: string, html: string) => ({
  parse: { title, revid: 1, text: html },
});
const STUB = '<div id="bodyContent"><p>Un village.</p></div>';

/** Answers in order, then repeats the last. */
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

describe.skipIf(url === null)('N.3 — the day’s article, on demand', () => {
  let store: TestDatabase;

  const deps = (answers: readonly unknown[], model = falsifier()): DailyDependencies => ({
    db: store.db,
    model,
    wiki: { language: 'fr', userAgent: 'WikiFake/2.0 (test)' },
    transport: wiki(answers),
    seed: () => 7,
  });

  const GOOD = [viewed('Chat'), page('Chat', HTML)];

  beforeAll(async () => {
    store = await openWebTestDatabase();
  });
  beforeEach(async () => {
    await store.truncate();
  });
  afterAll(async () => {
    await store.close();
  });

  it('generates the day when nobody has', async () => {
    const outcome = await ensureDailyArticle(deps(GOOD), AT);

    expect(outcome.status).toBe('ready');
    expect(outcome.status === 'ready' && outcome.article.topic).toBe('Chat');
    expect(outcome.status === 'ready' && outcome.article.day).toBe(DAY);
  });

  /*
   * The case the whole track is for: two players, one article. The second call
   * must not generate — it must read what the first wrote, down to the sentences.
   */
  it('serves the same article to the next caller, without generating again', async () => {
    const first = await ensureDailyArticle(deps(GOOD), AT);
    // A transport that would fail if it were used at all.
    const second = await ensureDailyArticle(deps([{ query: { mostviewed: [] } }]), AT);

    expect(second.status).toBe('ready');
    expect(first.status === 'ready' && second.status === 'ready').toBe(true);
    if (first.status === 'ready' && second.status === 'ready') {
      expect(second.article.paragraphs).toEqual(first.article.paragraphs);
      expect(second.article.solution).toEqual(first.article.solution);
    }
  });

  it('says somebody else is generating rather than generating a second one', async () => {
    await claimDay(store.db, DAY, new Date(AT));

    const outcome = await ensureDailyArticle(deps([{ query: { mostviewed: [] } }]), AT);

    expect(outcome.status).toBe('generating');
  });

  it('gives a different day a different article', async () => {
    await ensureDailyArticle(deps(GOOD), AT);
    await ensureDailyArticle(deps([viewed('Lyon'), page('Lyon', HTML)]), AT + 86_400_000);

    expect((await selectDay(store.db, DAY))?.topic).toBe('Chat');
    expect((await selectDay(store.db, DAY + 1))?.topic).toBe('Lyon');
  });
});

describe.skipIf(url === null)('N.3 — when the day cannot be made', () => {
  let store: TestDatabase;

  const deps = (answers: readonly unknown[], model = falsifier()): DailyDependencies => ({
    db: store.db,
    model,
    wiki: { language: 'fr', userAgent: 'WikiFake/2.0 (test)' },
    transport: wiki(answers),
    seed: () => 7,
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

  /*
   * A claim held by a generation that failed would leave the day empty until a
   * sweep ran. Releasing it means the next request tries again — which is the
   * difference between a bad minute and a bad day.
   */
  it('gives the claim back when no candidate can be played', async () => {
    const outcome = await ensureDailyArticle(
      deps([viewed('Stub'), page('Stub', STUB), { query: { random: [] } }]),
      AT,
    );

    expect(outcome.status).toBe('unavailable');
    // The proof it was released: the next caller is allowed to claim it.
    expect(await claimDay(store.db, DAY, new Date(AT))).toBe(true);
  });

  it('gives the claim back when the model refuses', async () => {
    const outcome = await ensureDailyArticle(
      deps([viewed('Chat'), page('Chat', HTML)], refuser()),
      AT,
    );

    expect(outcome.status).toBe('unavailable');
    expect(await claimDay(store.db, DAY, new Date(AT))).toBe(true);
  });

  /*
   * C4.5 — a generation that bought nothing was still billed. Dropping the
   * record is what makes the cost of failure invisible, which is the state the
   * Python was in.
   */
  it('records the model call it paid for even when it failed', async () => {
    await ensureDailyArticle(deps([viewed('Chat'), page('Chat', HTML)], refuser()), AT);

    expect(await store.db.select().from(llmCall)).not.toHaveLength(0);
  });

  it('leaves no half-written day behind', async () => {
    await ensureDailyArticle(deps([viewed('Chat'), page('Chat', HTML)], refuser()), AT);

    expect(await selectDay(store.db, DAY)).toBeNull();
  });
});
