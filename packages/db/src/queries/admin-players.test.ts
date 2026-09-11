// What the players section costs — step I.3, measured rather than assumed.
//
// Track I's exit gate asks for the panel in under a second, and this section is
// five reads. Two of them touch every account the game has ever had unless an
// index answers them, so the two indexes are the thing under test — and each is
// checked by **dropping it and watching the plan turn into a scan**, which is
// the only way to prove an index is doing work rather than merely existing.
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { countActiveSince, selectMostActive } from './admin-players.js';
import { playerStats } from '../schema/stats.js';
import { profile } from '../schema/profile.js';
import { user } from '../schema/auth.js';
import { openTestDatabase, testDatabaseUrl } from '../testing/database.js';
import type { TestDatabase } from '../testing/database.js';

const url = testDatabaseUrl();
const PLAYERS = 5_000;
const NOW = Date.UTC(2026, 8, 10, 15, 0, 0);
const DAY = 86_400_000;

describe.skipIf(url === null)('I.3 — the players section at volume', () => {
  let store: TestDatabase;

  beforeAll(async () => {
    store = await openTestDatabase(url as string);
    await store.truncate();

    // Five thousand accounts, a tenth of them seen today. That ratio is what
    // makes the index worth having: an index nothing filters out is an index
    // the planner ignores in favour of the scan it would have done anyway.
    const rows = Array.from({ length: PLAYERS }, (_, at) => ({
      id: `p${String(at).padStart(5, '0')}`,
      name: `p${String(at)}`,
      email: `p${String(at)}@example.test`,
      emailVerified: false,
    }));
    for (let at = 0; at < rows.length; at += 1000) {
      await store.db.insert(user).values(rows.slice(at, at + 1000));
    }
    for (let at = 0; at < rows.length; at += 1000) {
      await store.db.insert(profile).values(
        rows.slice(at, at + 1000).map((row) => ({
          userId: row.id,
          displayName: row.id,
          displayNameKey: row.id,
        })),
      );
      await store.db.insert(playerStats).values(
        rows.slice(at, at + 1000).map((row, index) => ({
          userId: row.id,
          gamesPlayed: (index % 17) + 1,
          gamesFinished: index % 13,
          // A tenth today, the rest spread over the past year.
          lastSeen: new Date(index % 10 === 0 ? NOW : NOW - ((index % 365) + 1) * DAY),
        })),
      );
    }
    await store.db.execute(sql`analyze player_stats`);
    await store.db.execute(sql`analyze profile`);
  }, 120_000);

  afterAll(async () => {
    await store.close();
  });

  const planFor = async (query: ReturnType<typeof sql>): Promise<string> => {
    const rows = await store.db.execute(sql`explain (analyze, buffers) ${query}`);
    return rows.map((row) => Object.values(row).join(' ')).join('\n');
  };

  // The instant as a literal rather than a parameter: `explain` prepares the
  // statement, and a `Date` bound into a prepared statement is a type the
  // driver refuses. It is the same instant either way.
  const AT = new Date(NOW).toISOString();
  const ACTIVE_TODAY = sql`select count(*) from player_stats
      where last_seen >= ${sql.raw(`timestamptz '${AT}'`)}`;
  const MOST_ACTIVE = sql`select s.user_id from player_stats s
      join profile p on p.user_id = s.user_id
      where s.games_finished >= 1
      order by s.games_finished desc nulls last, s.last_seen desc, s.user_id
      limit 10`;

  it('counts today from the index rather than from every account', async () => {
    expect(await planFor(ACTIVE_TODAY)).toContain('player_stats_last_seen_idx');
  });

  it('turns into a scan the moment that index is gone', async () => {
    // The half that makes the assertion above mean something. An `EXPLAIN` that
    // merely mentions an index name proves nothing about whether the query
    // needed it.
    await store.db.execute(sql`drop index player_stats_last_seen_idx`);
    try {
      expect(await planFor(ACTIVE_TODAY)).toMatch(/Seq Scan on player_stats/);
    } finally {
      await store.db.execute(
        sql`create index player_stats_last_seen_idx on player_stats (last_seen)`,
      );
    }
  });

  it('finds the most active without sorting every account', async () => {
    // `desc nulls last` in the query, matching what Drizzle writes into the
    // index — H.2's finding, and the reason the ordering is spelled out.
    expect(await planFor(MOST_ACTIVE)).toContain('player_stats_finished_idx');
  });

  it('sorts the whole table the moment that index is gone', async () => {
    await store.db.execute(sql`drop index player_stats_finished_idx`);
    try {
      const plan = await planFor(MOST_ACTIVE);
      expect(plan).not.toContain('player_stats_finished_idx');
      expect(plan).toMatch(/Sort|Seq Scan on player_stats/);
    } finally {
      await store.db.execute(
        sql`create index player_stats_finished_idx
            on player_stats (games_finished desc nulls last)`,
      );
    }
  });

  it('answers both reads in a time the exit gate can live with', async () => {
    // Not a benchmark — a floor. The gate asks for the panel in under a second
    // and this section is five reads, so a hundred milliseconds for the two
    // that touch every account is the budget being checked.
    const started = Date.now();
    await Promise.all([countActiveSince(store.db, NOW), selectMostActive(store.db, 10)]);

    expect(Date.now() - started).toBeLessThan(100);
  });

  it('agrees with the count the query is supposed to make', async () => {
    // The plan is only worth asserting if the answer is right. A tenth of five
    // thousand, seen today.
    expect(await countActiveSince(store.db, NOW)).toBe(PLAYERS / 10);
  });
});
