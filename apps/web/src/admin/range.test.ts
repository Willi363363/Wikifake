// The date range every section is read through — steps I.8 and K.2.
//
// Two halves: what a query string becomes, and whether the sections actually
// honour it. The second matters more — a period control that moved nothing
// would be a control that lied about the whole screen — so the second describe
// runs each read path against a real Postgres with rows on both sides of a
// boundary.
//
// **K.2 replaced rolling windows with calendar ones**, and the first half is
// rewritten rather than deleted: every claim I.8 made about a range is still a
// claim about this one, and three of them — the end of today, the default for
// nonsense, and the absence of a bound for all-time — are the reason the pages
// below it can be simple.
import { game, llmCall, participant, playerStats, profile, user } from '@wikifake/db';
import { MS_PER_DAY } from '@wikifake/domain';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  dayOf,
  isAllTime,
  lastDayOf,
  rangeFrom,
  windowOf,
  DEFAULT_PRESET,
  PRESETS,
} from './range.js';
import { readActivation } from './activation.js';
import { readContent } from './content.js';
import { readCost } from './cost.js';
import { readGames } from './games.js';
import { readPlayers } from './players.js';
import { openWebTestDatabase, webTestDatabaseUrl } from '../testing/database.js';
import type { TestDatabase } from '@wikifake/db/testing';

const url = webTestDatabaseUrl();
/** A Thursday, mid-afternoon UTC. 7 September 2026 was the Monday before it. */
const THURSDAY = Date.UTC(2026, 8, 10, 15, 0, 0);
/** Midnight after that Thursday, which is where every range ends. */
const END = Date.UTC(2026, 8, 11, 0, 0, 0);
/** No dates asked for — what every preset link produces. */
const NO_DAYS = { from: undefined, to: undefined };

describe('K.2 — what a query string becomes', () => {
  it('defaults to this month when nothing is asked for', () => {
    const range = rangeFrom(undefined, THURSDAY);

    expect(range.preset).toBe(DEFAULT_PRESET);
    expect(range.fromMs).toBe(Date.UTC(2026, 8, 1));
  });

  it('ends at the end of today, not at this instant', () => {
    // A player who finished a round ten minutes ago is in "this week". A bound
    // of *now* would leave them out, and would make the same page show
    // different numbers on each refresh.
    for (const preset of PRESETS) {
      expect(rangeFrom(preset, THURSDAY).toMs).toBe(END);
    }
    expect(END).toBeGreaterThan(THURSDAY);
  });

  it('starts each preset where its calendar period starts', () => {
    // The whole of K.2's decision, in one table. A rolling window would put
    // `week` seven days before Thursday; a calendar one puts it on Monday.
    for (const [preset, from] of [
      ['24h', Date.UTC(2026, 8, 10)],
      ['week', Date.UTC(2026, 8, 7)],
      ['month', Date.UTC(2026, 8, 1)],
      ['year', Date.UTC(2026, 0, 1)],
    ] as const) {
      const range = rangeFrom(preset, THURSDAY);
      expect(range.fromMs).toBe(from);
      expect(range.preset).toBe(preset);
    }
  });

  it('starts a week on Monday, which is the week a quest already uses', () => {
    // One clock, or a player finishing a daily quest at 00:30 UTC and a panel
    // counting their week are being measured on two of them.
    const monday = Date.UTC(2026, 8, 7, 0, 0, 0);

    expect(rangeFrom('week', monday).fromMs).toBe(monday);
    expect(rangeFrom('week', monday - 1).fromMs).toBe(Date.UTC(2026, 7, 31));
  });

  it('makes this month two days long on the 2nd, and says so by being short', () => {
    // The cost of calendar periods, asserted rather than regretted: "this
    // month" is not thirty days, and the bar prints the dates it covers so
    // nobody compares two of them blind.
    const second = Date.UTC(2026, 8, 2, 9, 0, 0);
    const range = rangeFrom('month', second);

    expect(range.fromMs).toBe(Date.UTC(2026, 8, 1));
    expect(range.toMs - range.fromMs).toBe(2 * MS_PER_DAY);
  });

  it('treats all-time as the absence of a bound, not a very wide one', () => {
    // G.3's distinction: a query given an artificial range scans to prove
    // every row qualifies, and one given none does not.
    const all = rangeFrom('all', THURSDAY);

    expect(isAllTime(all)).toBe(true);
    expect(windowOf(all)).toBeNull();
    expect(windowOf(rangeFrom('week', THURSDAY))).not.toBeNull();
  });

  it('shows the default for anything it does not recognise', () => {
    // A panel is not a form: a mistyped query string should show a month, not
    // a 400. And the bar must highlight what is *actually* being shown, so the
    // preset comes back as the default's name rather than as the typo.
    for (const asked of ['', 'yesterday', '7d', '30d', 'ALL', 'week ']) {
      const range = rangeFrom(asked, THURSDAY);
      expect(range.preset).toBe(DEFAULT_PRESET);
      expect(range.fromMs).toBe(Date.UTC(2026, 8, 1));
    }
  });

  it('offers every preset the bar draws', () => {
    for (const preset of PRESETS) {
      expect(rangeFrom(preset, THURSDAY).preset).toBe(preset);
    }
  });
});

describe('K.2 — a custom period, from two dates', () => {
  const custom = (from: string | undefined, to: string | undefined) =>
    rangeFrom('custom', THURSDAY, { from, to });

  it('counts both ends, which is what a date picker means', () => {
    // `to` is a day that counts, so the window runs to the midnight after it.
    // A half-open window ending *at* the 9th would silently drop a whole day.
    const range = custom('2026-09-01', '2026-09-09');

    expect(range.preset).toBe('custom');
    expect(range.fromMs).toBe(Date.UTC(2026, 8, 1));
    expect(range.toMs).toBe(Date.UTC(2026, 8, 10));
    expect(lastDayOf(range)).toBe('2026-09-09');
  });

  it('covers one day when both dates are the same day', () => {
    const range = custom('2026-09-09', '2026-09-09');

    expect(range.toMs - range.fromMs).toBe(MS_PER_DAY);
  });

  it('clamps a future end to the end of today rather than refusing it', () => {
    // Asking for everything up to next March is asking for everything up to
    // now, and that is what it gets.
    expect(custom('2026-09-01', '2027-03-01').toMs).toBe(END);
  });

  it('falls back to the default for a pair that is not a pair of days', () => {
    // Every one of these is a link somebody edited by hand. The panel shows a
    // month and names a month, rather than claiming a period it is not showing.
    for (const [from, to] of [
      ['2026-09-09', undefined],
      [undefined, '2026-09-09'],
      ['2026-09-09', '2026-09-01'],
      ['09/09/2026', '2026-09-10'],
      ['2026-02-31', '2026-09-10'],
      ['yesterday', 'today'],
    ] as const) {
      const range = custom(from, to);
      expect(range.preset).toBe(DEFAULT_PRESET);
      expect(range.fromMs).toBe(Date.UTC(2026, 8, 1));
    }
  });

  it('ignores two dates on a preset, because a preset is not a pair', () => {
    // `?range=week&from=…` is a stale link, not a custom period: the preset
    // wins, and nothing about the week moves.
    expect(
      rangeFrom('week', THURSDAY, { from: '2020-01-01', to: '2020-02-01' }).fromMs,
    ).toBe(Date.UTC(2026, 8, 7));
  });

  it('spells a day the way a date input and the address both do', () => {
    expect(dayOf(THURSDAY)).toBe('2026-09-10');
    expect(lastDayOf(rangeFrom('week', THURSDAY))).toBe('2026-09-10');
  });
});

describe.skipIf(url === null)('I.8 — the sections honour it', () => {
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

  /** A round, a seat, a model call and an account, all at one instant. */
  async function activity(id: string, atMs: number): Promise<void> {
    const at = new Date(atMs);
    await store.db.insert(user).values({
      id,
      name: id,
      email: `${id}@example.test`,
      emailVerified: false,
      createdAt: at,
    });
    // A pseudonym, because the most-active list joins `profile` for one — the
    // same join that keeps guests off it.
    await store.db.insert(profile).values({
      userId: id,
      displayName: id,
      displayNameKey: id,
    });
    await store.db.insert(playerStats).values({
      userId: id,
      gamesPlayed: 1,
      gamesFinished: 1,
      firstSeen: at,
      lastSeen: at,
    });
    const [row] = await store.db
      .insert(game)
      .values({
        mode: 'solo',
        topic: id,
        sourceUrl: `https://fr.wikipedia.org/wiki/${id}`,
        paragraphs: ['un'],
        totalFakes: 1,
        timeLimit: 300,
        startedAt: at,
        endedAt: at,
      })
      .returning({ id: game.id });
    await store.db
      .insert(participant)
      .values({ gameId: (row as { id: string }).id, userId: id, colour: '#1f574d' });
    await store.db.insert(llmCall).values({
      model: 'a-model',
      kind: 'falsification',
      inputTokens: 100,
      outputTokens: 50,
      promptChars: 10,
      outputChars: 5,
      createdAt: at,
    });
  }

  /** One inside the last seven days, one well outside. */
  async function both(): Promise<void> {
    await activity('recent', THURSDAY - 2 * MS_PER_DAY);
    await activity('ancient', THURSDAY - 60 * MS_PER_DAY);
  }

  // Monday to Thursday: `recent` is inside it and `ancient` is two months out.
  const week = () => rangeFrom('week', THURSDAY);
  const all = () => rangeFrom('all', THURSDAY, NO_DAYS);

  it('narrows the games section', async () => {
    await both();

    expect((await readGames({ db: store.db }, week())).total.rounds).toBe(1);
    expect((await readGames({ db: store.db }, all())).total.rounds).toBe(2);
  });

  it('narrows the content section', async () => {
    await both();

    const narrow = await readContent({ db: store.db }, week());
    expect(narrow.games).toBe(1);
    expect(narrow.topics.map((topic) => topic.topic)).toEqual(['recent']);
    expect(narrow.failures.falsificationCalls).toBe(1);

    expect((await readContent({ db: store.db }, all())).games).toBe(2);
  });

  it('narrows the cost section', async () => {
    await both();

    const narrow = await readCost({ db: store.db }, week());
    expect(narrow.totals.calls).toBe(1);
    expect(narrow.totals.gamesGenerated).toBe(1);
    expect(narrow.totals.players).toBe(1);

    expect((await readCost({ db: store.db }, all())).totals.calls).toBe(2);
  });

  it('narrows the players section to a cohort', async () => {
    // A cohort: accounts *created* in the range. The most-active list is not
    // narrowed, and its own test below says why.
    await both();

    const narrow = await readPlayers({ db: store.db }, week(), THURSDAY);
    expect(narrow.accounts).toBe(1);
    expect(narrow.everPlayed).toBe(1);
    expect(narrow.activeInRange).toBe(1);

    expect((await readPlayers({ db: store.db }, all(), THURSDAY)).accounts).toBe(2);
  });

  it('narrows the activation funnel to a cohort', async () => {
    // "Of the people who signed up in the last week, how many played" — which
    // is what an activation figure has always meant.
    await both();

    const narrow = await readActivation({ db: store.db }, week());
    expect(narrow.funnel.map((step) => step.count)).toEqual([1, 1, 1, 0]);

    expect((await readActivation({ db: store.db }, all())).funnel[0]?.count).toBe(2);
  });

  it('leaves the most-active list alone, and that is deliberate', async () => {
    // `games_finished` is a running total with no date on it, so a narrowed
    // list would be a list that looked ranged and was not. The screen says so.
    await both();

    const narrow = await readPlayers({ db: store.db }, week(), THURSDAY);
    expect(narrow.mostActive.map((player) => player.userId).sort()).toEqual([
      'ancient',
      'recent',
    ]);
  });

  it('includes a row on the period’s last day, and excludes its end', async () => {
    // Half-open, like every window here: `from <= at < to`. A round at the
    // very end of the last day is in; the first instant of the next day is not.
    await activity('lastDay', END - 1);
    await activity('nextDay', END);

    const narrow = await readGames({ db: store.db }, week());
    expect(narrow.total.rounds).toBe(1);
  });
});
