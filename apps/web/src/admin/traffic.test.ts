// Arrivals — step J.4b, against a real Postgres.
//
// The read is a fold and two sums, so what needs holding is the arithmetic at
// its edges: an empty range must not read as a reach of zero, `since` must be a
// fact about the table rather than about the range, and a day must arrive as
// one row with two numbers rather than as two rows.
import { recordPageView } from '@wikifake/db';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { readTraffic } from './traffic.js';
import { openWebTestDatabase, webTestDatabaseUrl } from '../testing/database.js';
import type { Range } from './range.js';
import type { TestDatabase } from '@wikifake/db/testing';

const url = webTestDatabaseUrl();

const DAY_MS = 86_400_000;
const OLD = new Date('2026-09-01T10:00:00.000Z');
const YESTERDAY = new Date('2026-09-10T10:00:00.000Z');
const TODAY = new Date('2026-09-11T10:00:00.000Z');

/** Every row, whatever its date — what these cases mean before a range. */
const ALL: Range = { fromMs: 0, toMs: Number.MAX_SAFE_INTEGER, preset: 'all' };

/** The two days ending with `TODAY`, as I.8's chooser would build them. */
const RECENT: Range = {
  fromMs: Date.parse('2026-09-10T00:00:00.000Z'),
  toMs: TODAY.getTime(),
  preset: 'custom',
};

describe.skipIf(url === null)('J.4b — the arrivals section', () => {
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

  const read = (range: Range = ALL) => readTraffic({ db: store.db }, range);

  it('sums the two pages and divides them', async () => {
    await recordPageView(store.db, 'landing', TODAY);
    await recordPageView(store.db, 'landing', TODAY);
    await recordPageView(store.db, 'landing', TODAY);
    await recordPageView(store.db, 'landing', TODAY);
    await recordPageView(store.db, 'entry', TODAY);

    const view = await read();

    expect(view.landing).toBe(4);
    expect(view.entry).toBe(1);
    expect(view.reach).toBe(0.25);
  });

  /*
   * Nothing arrived is not "everybody left".
   *
   * The distinction this whole section exists for: a reach of 0% says the
   * landing failed, and there is no honest way to say that about a day nobody
   * visited. `shareOf` answers null and the screen prints an em dash.
   */
  it('answers null rather than zero when nothing arrived', async () => {
    expect((await read()).reach).toBeNull();

    await recordPageView(store.db, 'entry', TODAY);
    // Reachable from a bookmark, with no landing view to divide by.
    expect((await read()).reach).toBeNull();
  });

  // Above one is not a defect: the entry screen is reachable without the
  // landing, and a ratio over 100% says the front door is not where players
  // come in. Asserted so nobody "fixes" it with a clamp.
  it('lets reach pass one', async () => {
    await recordPageView(store.db, 'landing', TODAY);
    await recordPageView(store.db, 'entry', TODAY);
    await recordPageView(store.db, 'entry', TODAY);

    expect((await read()).reach).toBe(2);
  });

  it('folds a day into one row, most recent first', async () => {
    await recordPageView(store.db, 'landing', YESTERDAY);
    await recordPageView(store.db, 'entry', YESTERDAY);
    await recordPageView(store.db, 'landing', TODAY);

    expect((await read()).days).toEqual([
      { day: '2026-09-11', landing: 1, entry: 0 },
      { day: '2026-09-10', landing: 1, entry: 1 },
    ]);
  });

  it('honours the range', async () => {
    await recordPageView(store.db, 'landing', OLD);
    await recordPageView(store.db, 'landing', YESTERDAY);

    const view = await read(RECENT);

    expect(view.landing).toBe(1);
    expect(view.days.map((day) => day.day)).toEqual(['2026-09-10']);
  });

  /*
   * `since` is a fact about the table, not about the range.
   *
   * Read over all time on purpose. Asking for it inside the window would answer
   * "the first day of the range", which is not a fact at all — and the sentence
   * it feeds exists to warn that a range reaching before this date covers days
   * nobody was counting.
   */
  it('reports the first day ever counted, even from a later range', async () => {
    await recordPageView(store.db, 'landing', OLD);
    await recordPageView(store.db, 'landing', YESTERDAY);

    const view = await read(RECENT);

    expect(view.since).toBe('2026-09-01');
    expect(view.days.map((day) => day.day)).toEqual(['2026-09-10']);
  });

  it('has no first day when nothing has been counted', async () => {
    expect((await read()).since).toBeNull();
  });

  it('counts today, on a range that ends now', async () => {
    // The half-open window ends at a clock reading rather than at midnight, so
    // the day in progress has to be in. A read that dropped it would show a
    // panel that is always one day behind, which is the failure nobody notices
    // because yesterday's figures look right.
    await recordPageView(store.db, 'landing', TODAY);

    const now: Range = {
      fromMs: TODAY.getTime() - 7 * DAY_MS,
      toMs: TODAY.getTime(),
      preset: '7d',
    };
    expect((await readTraffic({ db: store.db }, now)).landing).toBe(1);
  });
});
