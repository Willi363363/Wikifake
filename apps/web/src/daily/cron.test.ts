// The daily article cron — step N.4, against a real Postgres.
//
// The two properties the track asks for are the two cases that matter, and
// neither can be asserted against a fake: idempotence is a primary key, and the
// sweep is a scoped delete.
import { HTML, falsifier } from '@wikifake/article/testing';
import { claimDay, selectDay } from '@wikifake/db';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { CLAIM_STALE_AFTER_MS, type DailyDependencies } from './article.js';
import { prepareDailyArticle } from './cron.js';
import { openWebTestDatabase, webTestDatabaseUrl } from '../testing/database.js';
import type { TestDatabase } from '@wikifake/db/testing';

const url = webTestDatabaseUrl();

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

describe.skipIf(url === null)('N.4 — the daily cron', () => {
  let store: TestDatabase;

  const GOOD = [viewed('Chat'), pageOf('Chat', HTML)];
  const deps = (answers: readonly unknown[] = GOOD): DailyDependencies => ({
    db: store.db,
    model: falsifier(),
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

  it('makes the day when nobody has', async () => {
    const outcome = await prepareDailyArticle(deps(), AT);

    expect(outcome).toMatchObject({
      day: DAY,
      status: 'ready',
      generated: true,
      reopened: 0,
    });
  });

  /*
   * Idempotence, shown rather than claimed. A second run also ends `ready`, so
   * `generated` is what tells a log that this run made nothing — and a run that
   * made nothing has to look different from a run that never happened.
   */
  it('makes nothing on a second run for the same day', async () => {
    await prepareDailyArticle(deps(), AT);

    const again = await prepareDailyArticle(
      // A transport that would fail if it were used at all.
      deps([{ query: { mostviewed: [] } }]),
      AT + 60_000,
    );

    expect(again).toMatchObject({ status: 'ready', generated: false });
  });

  it('leaves a claim younger than the deadline alone', async () => {
    await claimDay(store.db, DAY, new Date(AT));

    const outcome = await prepareDailyArticle(deps(), AT + 60_000);

    expect(outcome).toMatchObject({
      status: 'generating',
      generated: false,
      reopened: 0,
    });
  });

  /*
   * The one thing here the read path does not already do. A claim that died
   * holds *its* day for ever — nobody asks for yesterday's article, so the read
   * path's own recovery never fires on it.
   */
  it('gives back a claim that died on an older day', async () => {
    await claimDay(store.db, DAY - 3, new Date(AT - 3 * 86_400_000));

    const outcome = await prepareDailyArticle(deps(), AT);

    expect(outcome.reopened).toBe(1);
    // Free to be taken again, which is what "given back" means.
    expect(await claimDay(store.db, DAY - 3, new Date(AT))).toBe(true);
  });

  it('takes today back from a claim that died, and makes the day', async () => {
    await claimDay(store.db, DAY, new Date(AT - CLAIM_STALE_AFTER_MS - 1000));

    const outcome = await prepareDailyArticle(deps(), AT);

    expect(outcome).toMatchObject({ status: 'ready', generated: true });
    expect(outcome.reopened).toBe(1);
    expect((await selectDay(store.db, DAY))?.topic).toBe('Chat');
  });

  it('says so when nothing can be made, and holds no claim', async () => {
    const outcome = await prepareDailyArticle(
      deps([{ query: { mostviewed: [] } }, { query: { random: [] } }]),
      AT,
    );

    expect(outcome).toMatchObject({ status: 'unavailable', generated: false });
    expect(await claimDay(store.db, DAY, new Date(AT))).toBe(true);
  });
});
