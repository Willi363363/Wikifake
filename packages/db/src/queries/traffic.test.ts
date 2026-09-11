// The arrival counter — step J.4, against a real Postgres.
//
// Two properties, and both are about the statement rather than the schema: the
// second load of a day **adds** to the first rather than failing on the key or
// replacing it, and two loads arriving at once both land. The second is the one
// that needs a real database: a read-then-write passes every sequential test
// ever written and loses one of two simultaneous arrivals, which is exactly the
// traffic this table exists to count.
//
// The races open **their own connections**, as `coins.test.ts` learned the hard
// way: `openTestDatabase` uses `max: 1`, so two statements on the shared handle
// are serialised by the pool and never contend.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { connect } from '../client.js';
import { recordPageView, selectPageViews, utcDay } from './traffic.js';
import { openTestDatabase, testDatabaseUrl } from '../testing/database.js';
import type { TestDatabase } from '../testing/database.js';

const url = testDatabaseUrl();

const MIDDAY = new Date('2026-09-11T12:00:00.000Z');
const EVENING = new Date('2026-09-11T23:30:00.000Z');
const NEXT_DAY = new Date('2026-09-12T00:30:00.000Z');

describe.skipIf(url === null)('J.4 — arrivals are counted, not stored', () => {
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

  it('counts the first load of a page', async () => {
    await recordPageView(store.db, 'landing', MIDDAY);

    expect(await selectPageViews(store.db, MIDDAY, MIDDAY)).toEqual([
      { day: '2026-09-11', page: 'landing', views: 1 },
    ]);
  });

  it('adds the next one to it rather than replacing it', async () => {
    await recordPageView(store.db, 'landing', MIDDAY);
    await recordPageView(store.db, 'landing', EVENING);

    const [row] = await selectPageViews(store.db, MIDDAY, EVENING);
    expect(row?.views).toBe(2);
  });

  it('keeps the two pages apart', async () => {
    await recordPageView(store.db, 'landing', MIDDAY);
    await recordPageView(store.db, 'entry', MIDDAY);
    await recordPageView(store.db, 'entry', MIDDAY);

    expect(await selectPageViews(store.db, MIDDAY, MIDDAY)).toEqual([
      { day: '2026-09-11', page: 'entry', views: 2 },
      { day: '2026-09-11', page: 'landing', views: 1 },
    ]);
  });

  /*
   * Half an hour past midnight is the next day, and the boundary is UTC.
   *
   * Not a detail: the admin range and `periodIndexOf` both measure their day in
   * UTC, and a counter that rolled over at the server's local midnight would
   * put an evening's arrivals on a day the section beside it calls yesterday.
   */
  it('rolls over at UTC midnight', async () => {
    await recordPageView(store.db, 'landing', EVENING);
    await recordPageView(store.db, 'landing', NEXT_DAY);

    expect(await selectPageViews(store.db, EVENING, NEXT_DAY)).toEqual([
      { day: '2026-09-11', page: 'landing', views: 1 },
      { day: '2026-09-12', page: 'landing', views: 1 },
    ]);
  });

  it('leaves a day outside the range out of the answer', async () => {
    await recordPageView(store.db, 'landing', EVENING);
    await recordPageView(store.db, 'landing', NEXT_DAY);

    expect(await selectPageViews(store.db, NEXT_DAY, NEXT_DAY)).toEqual([
      { day: '2026-09-12', page: 'landing', views: 1 },
    ]);
  });

  it('loses neither of two arrivals that land together', async () => {
    const [left, right] = [
      connect({ url: url as string, max: 1 }),
      connect({ url: url as string, max: 1 }),
    ];

    try {
      await Promise.all([
        recordPageView(left.db, 'landing', MIDDAY),
        recordPageView(right.db, 'landing', MIDDAY),
      ]);

      const [row] = await selectPageViews(store.db, MIDDAY, MIDDAY);
      // The whole reason the increment is `views + 1` inside the statement. A
      // read-then-write answers 1 here, and answers it intermittently.
      expect(row?.views).toBe(2);
    } finally {
      await Promise.all([left.close(), right.close()]);
    }
  });

  it('names the day the way the column stores it', () => {
    expect(utcDay(NEXT_DAY)).toBe('2026-09-12');
  });
});
