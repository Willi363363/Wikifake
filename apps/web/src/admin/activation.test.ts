// Activation and return — step I.4, against a real Postgres.
//
// The number the track says the panel exists for, so the cases are about the
// three ways it goes wrong: an account with no stats row dropped from the
// denominator, a guest counted as a sign-up, and *came back* meaning a second
// round rather than a second day.
//
// The fourth is division: nobody has signed up must not read as **0%**.
import { playerStats, user } from '@wikifake/db';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { readActivation, shareOf } from './activation.js';
import { openWebTestDatabase, webTestDatabaseUrl } from '../testing/database.js';
import type { TestDatabase } from '@wikifake/db/testing';

/** Every row, whatever its date: what these cases meant before I.8's range. */
const ALL = { fromMs: 0, toMs: Number.MAX_SAFE_INTEGER, preset: 'all' as const };

const url = webTestDatabaseUrl();
const DAY = 86_400_000;
const NOON = Date.UTC(2026, 8, 10, 12, 0, 0);

describe('I.4 — a share of a whole', () => {
  it('is null when there is no whole, not nought per cent', () => {
    // Nobody has signed up is not "nought per cent of people played". A panel
    // showing 0% on its headline figure the day before launch would report a
    // failure that has not happened.
    expect(shareOf(0, 0)).toBeNull();
    expect(shareOf(5, 0)).toBeNull();
    expect(shareOf(1, -1)).toBeNull();
  });

  it('is the ratio, unrounded', () => {
    // Rounding is presentation: a number rounded before it reaches the screen
    // is a number the screen cannot format for its locale.
    expect(shareOf(1, 3)).toBeCloseTo(0.333_333, 5);
    expect(shareOf(71, 120)).toBeCloseTo(0.591_666, 5);
    expect(shareOf(0, 10)).toBe(0);
    expect(shareOf(10, 10)).toBe(1);
  });
});

describe.skipIf(url === null)('I.4 — the funnel', () => {
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

  interface Player {
    readonly id: string;
    readonly guest?: boolean;
    /** Absent means no `player_stats` row: signed up and never pressed play. */
    readonly started?: boolean;
    readonly finished?: number;
    readonly firstSeenMs?: number;
    readonly lastSeenMs?: number;
  }

  async function add(player: Player): Promise<void> {
    await store.db.insert(user).values({
      id: player.id,
      name: player.id,
      email: `${player.id}@example.test`,
      emailVerified: false,
      isAnonymous: player.guest ?? false,
    });

    if (player.started ?? false) {
      await store.db.insert(playerStats).values({
        userId: player.id,
        gamesPlayed: 1,
        gamesFinished: player.finished ?? 0,
        firstSeen: new Date(player.firstSeenMs ?? NOON),
        lastSeen: new Date(player.lastSeenMs ?? player.firstSeenMs ?? NOON),
      });
    }
  }

  const read = () => readActivation({ db: store.db }, ALL);

  it('answers nothing rather than zero when nobody has signed up', async () => {
    const view = await read();

    expect(view.activation).toBeNull();
    expect(view.returnRate).toBeNull();
    expect(view.funnel.map((step) => step.count)).toEqual([0, 0, 0, 0]);
  });

  it('keeps an account that never pressed play in the denominator', async () => {
    // The `left join`'s whole reason: a `player_stats` row appears when a first
    // round starts, so an inner join would drop exactly the people the first
    // ratio is about.
    await add({ id: 'never' });
    await add({ id: 'played', started: true, finished: 1 });

    const view = await read();

    expect(view.funnel.map((step) => step.count)).toEqual([2, 1, 1, 0]);
    expect(view.activation).toBe(0.5);
  });

  it('does not count a guest anywhere in the funnel', async () => {
    // A guest cannot be a created account, and including them would put the
    // denominator at the mercy of how many browsers opened the site.
    await add({ id: 'ada', started: true, finished: 1 });
    await add({ id: 'ghost', guest: true, started: true, finished: 9 });

    expect((await read()).funnel.map((step) => step.count)).toEqual([1, 1, 1, 0]);
  });

  it('separates started from finished', async () => {
    await add({ id: 'quitter', started: true, finished: 0 });
    await add({ id: 'finisher', started: true, finished: 1 });

    const view = await read();

    expect(view.funnel.map((step) => step.count)).toEqual([2, 2, 1, 0]);
    // The step above, which is where people were lost.
    expect(view.funnel[2]?.ofPrevious).toBe(0.5);
  });

  it('counts coming back as a later day, not a second round', async () => {
    // Two rounds in one sitting is not coming back, and `games_finished >= 2`
    // would count it as though it were.
    await add({
      id: 'sameDay',
      started: true,
      finished: 5,
      firstSeenMs: NOON,
      lastSeenMs: NOON + 3 * 3_600_000,
    });
    await add({
      id: 'nextDay',
      started: true,
      finished: 2,
      firstSeenMs: NOON,
      lastSeenMs: NOON + DAY,
    });

    const view = await read();

    expect(view.funnel[3]?.count).toBe(1);
    expect(view.returnRate).toBe(0.5);
  });

  it('counts a return just after midnight, which is a different day', async () => {
    // The boundary is a UTC day, the same one `periodIndexOf` uses — so a panel
    // and a daily quest agree about what a day is. Late one evening and early
    // the next morning is coming back.
    await add({
      id: 'lateAndEarly',
      started: true,
      finished: 2,
      firstSeenMs: Date.UTC(2026, 8, 10, 23, 50, 0),
      lastSeenMs: Date.UTC(2026, 8, 11, 0, 10, 0),
    });

    expect((await read()).funnel[3]?.count).toBe(1);
  });

  it('divides the return rate by the people who could come back', async () => {
    // Not by accounts created: coming back is a thing only somebody who played
    // can do, and the other denominator would blame the return rate for a
    // sign-up funnel's losses.
    await add({ id: 'never' });
    await add({ id: 'never2' });
    await add({ id: 'once', started: true, finished: 1 });
    await add({
      id: 'twice',
      started: true,
      finished: 2,
      firstSeenMs: NOON,
      lastSeenMs: NOON + DAY,
    });

    const view = await read();

    expect(view.activation).toBe(0.5);
    expect(view.returnRate).toBe(0.5);
  });

  it('measures each step against the one above and against the top', async () => {
    await add({ id: 'a' });
    await add({ id: 'b', started: true, finished: 0 });
    await add({ id: 'c', started: true, finished: 1 });
    await add({
      id: 'd',
      started: true,
      finished: 3,
      firstSeenMs: NOON,
      lastSeenMs: NOON + DAY,
    });

    const [created, started, finished, returned] = (await read()).funnel;

    expect(created?.ofPrevious).toBeNull();
    expect(created?.ofCreated).toBeNull();
    expect(started?.count).toBe(3);
    expect(started?.ofPrevious).toBe(0.75);
    expect(finished?.ofPrevious).toBeCloseTo(2 / 3, 5);
    expect(finished?.ofCreated).toBe(0.5);
    expect(returned?.ofPrevious).toBe(0.5);
    expect(returned?.ofCreated).toBe(0.25);
  });

  it('names the steps in funnel order', async () => {
    expect((await read()).funnel.map((step) => step.name)).toEqual([
      'created',
      'started',
      'finished',
      'returned',
    ]);
  });

  it('never lets a step exceed the one above it', async () => {
    // The property that makes it a funnel rather than four numbers. If a future
    // clause broke the nesting, every ratio above would be over one.
    for (const player of ['a', 'b', 'c', 'd', 'e']) {
      await add({
        id: player,
        started: player !== 'a',
        finished: player > 'b' ? 2 : 0,
        firstSeenMs: NOON,
        lastSeenMs: player > 'c' ? NOON + DAY : NOON,
      });
    }

    const counts = (await read()).funnel.map((step) => step.count);
    for (let at = 1; at < counts.length; at += 1) {
      expect(counts[at]).toBeLessThanOrEqual(counts[at - 1] as number);
    }
  });
});
