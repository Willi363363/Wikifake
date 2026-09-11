// The date range every section is read through — step I.8.
//
// Two halves: what a query string becomes, and whether the sections actually
// honour it. The second matters more — a range control that moved nothing
// would be a control that lied about the whole screen — so the second describe
// runs each read path against a real Postgres with rows on both sides of a
// boundary.
import { game, llmCall, participant, playerStats, profile, user } from '@wikifake/db';
import { MS_PER_DAY } from '@wikifake/domain';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { isAllTime, rangeFrom, windowOf, DEFAULT_PRESET, PRESETS } from './range.js';
import { readActivation } from './activation.js';
import { readContent } from './content.js';
import { readCost } from './cost.js';
import { readGames } from './games.js';
import { readPlayers } from './players.js';
import { openWebTestDatabase, webTestDatabaseUrl } from '../testing/database.js';
import type { TestDatabase } from '@wikifake/db/testing';

const url = webTestDatabaseUrl();
/** A Thursday, mid-afternoon UTC. */
const THURSDAY = Date.UTC(2026, 8, 10, 15, 0, 0);
/** Midnight after that Thursday, which is where every range ends. */
const END = Date.UTC(2026, 8, 11, 0, 0, 0);

describe('I.8 — what a query string becomes', () => {
  it('defaults to a month when nothing is asked for', () => {
    const range = rangeFrom(undefined, THURSDAY);

    expect(range.preset).toBe(DEFAULT_PRESET);
    expect(range.toMs - range.fromMs).toBe(30 * MS_PER_DAY);
  });

  it('ends at the end of today, not at this instant', () => {
    // A player who finished a round ten minutes ago is in "the last seven
    // days". A bound of *now* would leave them out, and would make the same
    // page show different numbers on each refresh.
    expect(rangeFrom('7d', THURSDAY).toMs).toBe(END);
    expect(rangeFrom('7d', THURSDAY).toMs).toBeGreaterThan(THURSDAY);
  });

  it('gives each preset the width it says', () => {
    for (const [preset, days] of [
      ['7d', 7],
      ['30d', 30],
      ['90d', 90],
    ] as const) {
      const range = rangeFrom(preset, THURSDAY);
      expect(range.toMs - range.fromMs).toBe(days * MS_PER_DAY);
      expect(range.preset).toBe(preset);
    }
  });

  it('treats all-time as the absence of a bound, not a very wide one', () => {
    // G.3's distinction: a query given an artificial range scans to prove
    // every row qualifies, and one given none does not.
    const all = rangeFrom('all', THURSDAY);

    expect(isAllTime(all)).toBe(true);
    expect(windowOf(all)).toBeNull();
    expect(windowOf(rangeFrom('7d', THURSDAY))).not.toBeNull();
  });

  it('shows a month for anything it does not recognise', () => {
    // A panel is not a form: a mistyped query string should show a month, not
    // a 400. And the chooser must highlight what is *actually* being shown, so
    // the preset comes back as the default's name rather than as the typo.
    for (const asked of ['', 'yesterday', '7', '30d ', 'ALL']) {
      const range = rangeFrom(asked, THURSDAY);
      expect(range.preset).toBe(DEFAULT_PRESET);
      expect(range.toMs - range.fromMs).toBe(30 * MS_PER_DAY);
    }
  });

  it('offers every preset the chooser draws', () => {
    for (const preset of PRESETS) {
      expect(rangeFrom(preset, THURSDAY).preset).toBe(preset);
    }
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

  const week = () => rangeFrom('7d', THURSDAY);
  const all = () => rangeFrom('all', THURSDAY);

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

  it('includes a row on the range’s last day, and excludes its end', async () => {
    // Half-open, like every window here: `from <= at < to`. A round at the
    // very end of the last day is in; the first instant of the next day is not.
    await activity('lastDay', END - 1);
    await activity('nextDay', END);

    const narrow = await readGames({ db: store.db }, week());
    expect(narrow.total.rounds).toBe(1);
  });
});
