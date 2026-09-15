// The day's article, against a real Postgres — step N.1.
//
// Every case here is about a race or a constraint, which is why none of them is
// a unit test: `on conflict do nothing`, a scoped update and a check constraint
// are things the database does, and a fake would only prove the fake agrees with
// itself.
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  claimDay,
  fillDay,
  openClaimsBefore,
  reopenStaleClaim,
  selectDay,
} from './daily.js';
import { dailyArticle } from '../schema/daily.js';
import { openTestDatabase, rejectionCode, testDatabaseUrl } from '../testing/database.js';
import type { TestDatabase } from '../testing/database.js';

const url = testDatabaseUrl();

/** Day 20706 is 2026-09-10. The number only has to be stable. */
const DAY = 20_706;
const AT = new Date('2026-09-10T04:00:00.000Z');

const ARTICLE = {
  topic: 'Tour Eiffel',
  sourceUrl: 'https://fr.wikipedia.org/wiki/Tour_Eiffel',
  paragraphs: ['un paragraphe', 'un autre'],
  solution: [{ paragraphIndex: 1, falseInfoNumber: 1, falseStatement: 'faux' }],
  totalFakes: 1,
};

describe.skipIf(url === null)('N.1 — the claim', () => {
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

  it('is granted to the first caller', async () => {
    expect(await claimDay(store.db, DAY, AT)).toBe(true);
  });

  /*
   * The statement the whole track turns on. Two callers, one day: exactly one is
   * told to generate, and the other is told to read. Without this, fifty players
   * arriving at midnight buy fifty articles.
   */
  it('is refused to every caller after the first', async () => {
    const answers = await Promise.all([
      claimDay(store.db, DAY, AT),
      claimDay(store.db, DAY, AT),
      claimDay(store.db, DAY, AT),
    ]);

    expect(answers.filter(Boolean)).toHaveLength(1);
  });

  it('is a different claim for a different day', async () => {
    expect(await claimDay(store.db, DAY, AT)).toBe(true);
    expect(await claimDay(store.db, DAY + 1, AT)).toBe(true);
  });

  // A claim is the row's existence, so a claimed day is not a ready day.
  it('does not make the day readable on its own', async () => {
    await claimDay(store.db, DAY, AT);

    expect(await selectDay(store.db, DAY)).toBeNull();
  });
});

describe.skipIf(url === null)('N.1 — filling a day', () => {
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

  it('makes the day readable, with what was written', async () => {
    await claimDay(store.db, DAY, AT);
    expect(await fillDay(store.db, DAY, ARTICLE, AT)).toBe(true);

    const day = await selectDay(store.db, DAY);

    expect(day).toMatchObject({
      day: DAY,
      topic: 'Tour Eiffel',
      sourceUrl: 'https://fr.wikipedia.org/wiki/Tour_Eiffel',
      totalFakes: 1,
    });
    expect(day?.paragraphs).toEqual(ARTICLE.paragraphs);
    expect(day?.solution).toEqual(ARTICLE.solution);
  });

  /*
   * A retried generation must not replace the article players are already
   * reading. The update is scoped to a row with no article, so the second fill
   * writes nothing rather than overwriting — and says so rather than throwing,
   * because a caller retrying is not a caller in error.
   */
  it('refuses to replace an article already served', async () => {
    await claimDay(store.db, DAY, AT);
    await fillDay(store.db, DAY, ARTICLE, AT);

    const again = await fillDay(
      store.db,
      DAY,
      { ...ARTICLE, topic: 'Lyon' },
      new Date(AT.getTime() + 60_000),
    );

    expect(again).toBe(false);
    expect((await selectDay(store.db, DAY))?.topic).toBe('Tour Eiffel');
  });

  it('writes nothing for a day nobody claimed', async () => {
    expect(await fillDay(store.db, DAY, ARTICLE, AT)).toBe(false);
  });

  /*
   * Filled or not filled, never half. A day served with no solution is a round
   * nobody can be graded on, so the database refuses the shape rather than every
   * reader checking for it.
   */
  it('refuses a half-filled row at the database', async () => {
    await claimDay(store.db, DAY, AT);

    const half = store.db
      .update(dailyArticle)
      .set({ topic: 'Lyon' })
      .where(eq(dailyArticle.day, DAY))
      .execute();

    expect(await rejectionCode(half)).toBe('23514');
  });

  it('refuses a day with no falsification in it', async () => {
    await claimDay(store.db, DAY, AT);

    const none = fillDay(store.db, DAY, { ...ARTICLE, totalFakes: 0 }, AT);

    expect(await rejectionCode(none)).toBe('23514');
  });
});

describe.skipIf(url === null)('N.1 — a claim that died', () => {
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

  const LATER = new Date(AT.getTime() + 3_600_000);

  it('is visible to the sweep once its deadline has passed', async () => {
    await claimDay(store.db, DAY, AT);

    expect(await openClaimsBefore(store.db, LATER)).toEqual([
      { day: DAY, claimedAt: AT },
    ]);
  });

  it('is not visible while it is still within its deadline', async () => {
    await claimDay(store.db, DAY, AT);

    expect(await openClaimsBefore(store.db, AT)).toEqual([]);
  });

  it('is not visible once it has been filled', async () => {
    await claimDay(store.db, DAY, AT);
    await fillDay(store.db, DAY, ARTICLE, AT);

    expect(await openClaimsBefore(store.db, LATER)).toEqual([]);
  });

  it('can be given back, and then taken again', async () => {
    await claimDay(store.db, DAY, AT);

    expect(await reopenStaleClaim(store.db, DAY, LATER)).toBe(true);
    expect(await claimDay(store.db, DAY, LATER)).toBe(true);
  });

  /*
   * The safety that is not the caller's to get right. The deadline is N.3's
   * policy and it may be wrong; deleting a day players are reading must not be
   * possible even so.
   */
  it('cannot be given back once it has an article', async () => {
    await claimDay(store.db, DAY, AT);
    await fillDay(store.db, DAY, ARTICLE, AT);

    expect(await reopenStaleClaim(store.db, DAY, LATER)).toBe(false);
    expect(await selectDay(store.db, DAY)).not.toBeNull();
  });

  it('cannot be given back before its deadline', async () => {
    await claimDay(store.db, DAY, AT);

    expect(await reopenStaleClaim(store.db, DAY, AT)).toBe(false);
  });
});
