// Who plays, and how recently — step I.3, against a real Postgres.
//
// Every figure on this section is a count, and a count is the easiest thing in
// the world to get subtly wrong: guests folded into sign-ups, a player counted
// once per round, a boundary that is a different midnight from the one the rest
// of the game uses. Those three are what most of these cases are about.
//
// The clock is a parameter, so *today* is a Thursday in a fixture rather than a
// wait.
import { playerStats, profile, user } from '@wikifake/db';
import { periodIndexOf, periodWindowOf, MS_PER_DAY } from '@wikifake/domain';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { readPlayers, MOST_ACTIVE } from './players.js';
import { openWebTestDatabase, webTestDatabaseUrl } from '../testing/database.js';
import type { TestDatabase } from '@wikifake/db/testing';

const url = webTestDatabaseUrl();

/** A Thursday, mid-afternoon UTC. Week 2900 began on the Monday before it. */
const THURSDAY = Date.UTC(2026, 8, 10, 15, 0, 0);

describe.skipIf(url === null)('I.3 — players and activity', () => {
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
    readonly named?: boolean;
    readonly played?: number;
    readonly finished?: number;
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

    if (player.named ?? !(player.guest ?? false)) {
      await store.db
        .insert(profile)
        .values({ userId: player.id, displayName: player.id, displayNameKey: player.id });
    }

    if (player.played !== undefined || player.lastSeenMs !== undefined) {
      await store.db.insert(playerStats).values({
        userId: player.id,
        gamesPlayed: player.played ?? 0,
        gamesFinished: player.finished ?? 0,
        lastSeen: new Date(player.lastSeenMs ?? THURSDAY),
      });
    }
  }

  const read = (atMs = THURSDAY) => readPlayers({ db: store.db }, atMs);

  it('counts nothing when there is nothing', async () => {
    const view = await read();

    expect(view).toEqual({
      accounts: 0,
      guests: 0,
      everPlayed: 0,
      activeToday: 0,
      activeThisWeek: 0,
      mostActive: [],
    });
  });

  it('does not count a guest as a sign-up', async () => {
    // A guest is a real `user` row — step 4.3 — so `count(*)` is not "signed
    // up". A panel reporting it as such would be wrong in the flattering
    // direction, which is the worst direction for a figure to be wrong in.
    await add({ id: 'ada' });
    await add({ id: 'ghost', guest: true });

    const view = await read();

    expect(view.accounts).toBe(1);
    expect(view.guests).toBe(1);
  });

  it('counts a row that predates the anonymous plugin as an account', async () => {
    // `is_anonymous` is nullable, which is the plugin's own declaration.
    await store.db.insert(user).values({
      id: 'old',
      name: 'old',
      email: 'old@example.test',
      emailVerified: false,
      isAnonymous: null,
    });

    expect((await read()).accounts).toBe(1);
  });

  it('counts a player once however many rounds they played today', async () => {
    // Players and not sessions: eleven rounds is one active player, and a
    // session count would go up when a phone lost its network.
    await add({ id: 'ada', played: 11, finished: 11, lastSeenMs: THURSDAY });

    expect((await read()).activeToday).toBe(1);
  });

  it('uses the same midnight as a daily quest and a daily board', async () => {
    /*
     * The reason `periodWindowOf` is called rather than a boundary computed
     * here: a panel with its own midnight reports a different day from the
     * leaderboard beside it, and both are defensible.
     *
     * One player a minute after today began, one a minute before.
     */
    const today = periodWindowOf('daily', periodIndexOf('daily', THURSDAY));
    await add({ id: 'inside', played: 1, lastSeenMs: today.fromMs + 60_000 });
    await add({ id: 'outside', played: 1, lastSeenMs: today.fromMs - 60_000 });

    const view = await read();

    expect(view.activeToday).toBe(1);
    // Both are inside the week, which begins on the Monday before.
    expect(view.activeThisWeek).toBe(2);
  });

  it('counts the week from Monday, not from seven days ago', async () => {
    const week = periodWindowOf('weekly', periodIndexOf('weekly', THURSDAY));
    // Six days before a Thursday is the Friday before — inside seven days, and
    // outside this week.
    await add({ id: 'lastFriday', played: 1, lastSeenMs: THURSDAY - 6 * MS_PER_DAY });
    await add({ id: 'monday', played: 1, lastSeenMs: week.fromMs + 60_000 });

    expect((await read()).activeThisWeek).toBe(1);
  });

  it('counts as ever-played only those who finished something', async () => {
    // Started is what an abandoned round also increments.
    await add({ id: 'finisher', played: 3, finished: 1 });
    await add({ id: 'quitter', played: 3, finished: 0 });

    expect((await read()).everPlayed).toBe(1);
  });

  it('ranks the most active by rounds finished, not started', async () => {
    await add({ id: 'steady', played: 5, finished: 5 });
    await add({ id: 'restless', played: 40, finished: 2 });

    expect((await read()).mostActive.map((player) => player.userId)).toEqual([
      'steady',
      'restless',
    ]);
  });

  it('leaves out anybody who has finished nothing', async () => {
    await add({ id: 'quitter', played: 9, finished: 0 });

    expect((await read()).mostActive).toEqual([]);
  });

  it('leaves out a guest, who has no name to print', async () => {
    // The inner join to `profile` does both jobs: it supplies the pseudonym and
    // it restricts the list to accounts. A filter by construction rather than a
    // `where` clause somebody has to remember.
    await add({ id: 'ghost', guest: true, played: 9, finished: 9 });

    expect((await read()).mostActive).toEqual([]);
  });

  it('shows the pseudonym and nothing else about a player', async () => {
    // E.3.3's promise holds on the admin panel too. There is no field for an
    // email here, so there is nothing to leak.
    await add({ id: 'ada', played: 2, finished: 2 });

    const [player] = (await read()).mostActive;
    expect(player?.displayName).toBe('ada');
    expect(Object.keys(player ?? {}).sort()).toEqual([
      'displayName',
      'gamesFinished',
      'gamesPlayed',
      'lastSeen',
      'userId',
    ]);
  });

  it('breaks a tie by recency, then by id, so two reads agree', async () => {
    await add({ id: 'b', played: 2, finished: 2, lastSeenMs: THURSDAY - 1000 });
    await add({ id: 'a', played: 2, finished: 2, lastSeenMs: THURSDAY });
    await add({ id: 'c', played: 2, finished: 2, lastSeenMs: THURSDAY - 1000 });

    expect((await read()).mostActive.map((player) => player.userId)).toEqual([
      'a',
      'b',
      'c',
    ]);
  });

  it('shows a sample rather than a board', async () => {
    for (let at = 0; at < MOST_ACTIVE + 5; at += 1) {
      await add({ id: `p${String(at).padStart(2, '0')}`, played: 1, finished: 1 });
    }

    expect((await read()).mostActive).toHaveLength(MOST_ACTIVE);
  });
});
