// Who plays, and how recently — step I.3.
//
// **Every figure is a query, and none of them is arithmetic in TypeScript.**
// That is track I's exit gate in as many words: *every figure traces to a query
// somebody can read, with no in-memory maths that a second implementation could
// disagree with*. So a count is `count(*)`, a distinct count is
// `count(distinct …)`, and nothing here loads rows to length them.
//
// The windows arrive as instants rather than being computed here, because
// `@wikifake/domain` owns what a day is — and *today* on this panel has to be
// the same today as a daily quest and a daily leaderboard, or three screens are
// measuring three different days.
import { and, count, desc, eq, gte, isNotNull, lt, sql, type SQL } from 'drizzle-orm';

import type { Database } from '../client.js';
import { playerStats } from '../schema/stats.js';
import { profile } from '../schema/profile.js';
import { user } from '../schema/auth.js';

type Tx = Parameters<Parameters<Database['db']['transaction']>[0]>[0];
type Db = Database['db'] | Tx;

/** I.8's window, or null for everything. */
export interface Window {
  readonly fromMs: number;
  readonly toMs: number;
}

/**
 * Accounts created within the window — **a cohort, not a period.**
 *
 * This is the one place in the panel where a range picks *who* rather than
 * *when*, and it is the reading an activation figure has always had: "of the
 * people who signed up in September, how many played" is a question about
 * September's arrivals whenever they played, not about September's rounds.
 */
function createdWithin(window: Window | null): SQL | undefined {
  if (window === null) return undefined;
  return and(
    gte(user.createdAt, new Date(window.fromMs)),
    lt(user.createdAt, new Date(window.toMs)),
  );
}

/**
 * How many accounts exist, and how many of them are guests.
 *
 * **Two numbers rather than one, because a guest is a `user` row.** Step 4.3
 * gives a guest a real identity so the rounds they play follow them into an
 * account, which means `count(*) from "user"` is not *signed up* — it is signed
 * up plus everybody who ever clicked play. A panel reporting that as sign-ups
 * would be a panel whose headline figure is wrong in the flattering direction.
 *
 * `is_anonymous` is nullable — the plugin's own declaration — and a row that
 * predates it reads as not anonymous, which is correct.
 */
export async function countAccounts(
  db: Db,
  window: Window | null,
): Promise<{ accounts: number; guests: number }> {
  const [row] = await db
    .select({
      accounts: sql<number>`count(*) filter (where ${user.isAnonymous} is not true)::int`,
      guests: sql<number>`count(*) filter (where ${user.isAnonymous} is true)::int`,
    })
    .from(user)
    .where(createdWithin(window));

  return { accounts: row?.accounts ?? 0, guests: row?.guests ?? 0 };
}

/**
 * How many players have been seen since an instant.
 *
 * `player_stats.last_seen` moves on every round started or finished — E.4 named
 * these two columns for this panel rather than letting it invent a parallel
 * definition, and this is the query that reads them.
 *
 * **Players and not sessions.** One row per player, so somebody who played
 * eleven rounds today counts once. A session count would go up when a phone
 * lost its network, which is activity of the wrong kind.
 *
 * An index range on `last_seen`, not a scan: the panel's exit gate asks for
 * under a second, and this runs three times per page load.
 */
export async function countActiveSince(db: Db, sinceMs: number): Promise<number> {
  const [row] = await db
    .select({ players: count() })
    .from(playerStats)
    .where(gte(playerStats.lastSeen, new Date(sinceMs)));

  return row?.players ?? 0;
}

export interface ActivePlayer {
  readonly userId: string;
  /** E.3.3's promise: a pseudonym, never an email, on any screen. */
  readonly displayName: string;
  readonly gamesPlayed: number;
  readonly gamesFinished: number;
  readonly lastSeen: Date;
}

/**
 * The most active players, by rounds finished.
 *
 * **Finished and not started**, because started is what an abandoned round also
 * increments — a list topped by somebody who opens rounds and leaves would be a
 * list of the wrong thing.
 *
 * The inner join to `profile` does two jobs at once, which is the leaderboard's
 * arrangement: it supplies the pseudonym, and it restricts the list to accounts
 * — a guest has no `profile` row and so no name to print. That is a filter by
 * construction rather than a `where` clause somebody has to remember.
 *
 * A total order, so two calls with the same data return the same list: rounds
 * finished, then the more recently seen, then the id.
 */
export async function selectMostActive(
  db: Db,
  limit: number,
): Promise<readonly ActivePlayer[]> {
  return (
    db
      .select({
        userId: playerStats.userId,
        displayName: profile.displayName,
        gamesPlayed: playerStats.gamesPlayed,
        gamesFinished: playerStats.gamesFinished,
        lastSeen: playerStats.lastSeen,
      })
      .from(playerStats)
      .innerJoin(profile, eq(profile.userId, playerStats.userId))
      .where(gte(playerStats.gamesFinished, 1))
      // `nulls last` spelled out, which H.2 learned the hard way: `order by x
      // desc` is `nulls first` in SQL and Drizzle writes `desc nulls last` into
      // the index, so the two disagree and the index goes unused. The column is
      // `not null`, so this changes no row — it changes whether the plan can use
      // the index, and relying on a column staying non-null is relying on the
      // wrong thing.
      .orderBy(
        sql`${playerStats.gamesFinished} desc nulls last`,
        desc(playerStats.lastSeen),
        playerStats.userId,
      )
      .limit(limit)
  );
}

/**
 * How many accounts have ever finished a round — the denominator's other half.
 *
 * Here rather than in I.4 because it is one clause on the same table, and
 * because `signed up` beside `ever played` is the only pair on this section
 * that means anything on its own: a thousand accounts and forty players is a
 * different game from a thousand accounts and nine hundred players.
 */
export async function countEverPlayed(db: Db, window: Window | null): Promise<number> {
  const [row] = await db
    .select({ players: count() })
    .from(playerStats)
    .innerJoin(user, eq(user.id, playerStats.userId))
    .where(
      and(
        gte(playerStats.gamesFinished, 1),
        isNotNull(user.email),
        createdWithin(window),
      ),
    );

  return row?.players ?? 0;
}

/**
 * The funnel — step I.4, and the reason the panel exists.
 *
 * Four numbers, each a subset of the one before: **created, started, finished,
 * returned.** The track is blunt about why — *accounts created goes up and
 * means nothing; the ratio of people who signed up to people who played, and of
 * people who played once to people who played twice, is the one figure that
 * says whether the game works.*
 *
 * One query and not four, because they are four `count(… ) filter (where …)`
 * over the same left join: asking separately would be four scans and, worse,
 * four chances for the population to differ between them.
 *
 * **`left join`, because the funnel's first step is accounts with no stats
 * row at all.** A player gets a `player_stats` row when their first round
 * starts, so somebody who signed up and never pressed play has none — and an
 * inner join would drop exactly the people the first ratio is about.
 *
 * **Guests are excluded.** They cannot be *created accounts*, and including
 * them would put the whole funnel's denominator at the mercy of how many
 * browsers opened the site.
 */
export interface Funnel {
  /** Accounts, guests excluded. The denominator of everything below. */
  readonly created: number;
  /** …that started at least one round. */
  readonly started: number;
  /** …that finished at least one. */
  readonly finished: number;
  /**
   * …that were active on a later **day** than their first.
   *
   * A day and not a round: two rounds in one sitting is not coming back, and
   * `games_finished >= 2` would count it as though it were. `first_seen` is the
   * row's creation and `last_seen` moves on every round, so a later date on the
   * second is somebody who came back — which is as much as these two columns
   * can answer, and it is the question worth asking.
   *
   * What it cannot say is *how much* later: a return the next day and a return
   * six months on are the same row here. A cohort curve needs per-day history,
   * which nothing records — noted in `09-admin-activation.md` rather than
   * guessed at.
   */
  readonly returned: number;
}

export async function selectFunnel(db: Db, window: Window | null): Promise<Funnel> {
  const [row] = await db
    .select({
      created: sql<number>`count(*)::int`,
      started: sql<number>`count(${playerStats.userId})::int`,
      finished: sql<number>`count(*) filter (where ${playerStats.gamesFinished} >= 1)::int`,
      // `date_trunc` in UTC, which is the day every other period in this
      // repository is measured in — `periodIndexOf`'s decision, and a panel
      // that used the server's local day would disagree with the leaderboard.
      returned: sql<number>`count(*) filter (
        where date_trunc('day', ${playerStats.lastSeen} at time zone 'UTC')
            > date_trunc('day', ${playerStats.firstSeen} at time zone 'UTC')
      )::int`,
    })
    .from(user)
    .leftJoin(playerStats, eq(playerStats.userId, user.id))
    // The window narrows the cohort — who signed up — and not the rounds they
    // then played. `games_finished` is a running total with no date on it, so
    // "finished a round this week" is a question the schema cannot answer;
    // "of the people who signed up this week, how many have finished one" is
    // the question it can, and is the one activation has always meant.
    .where(and(sql`${user.isAnonymous} is not true`, createdWithin(window)));

  return {
    created: row?.created ?? 0,
    started: row?.started ?? 0,
    finished: row?.finished ?? 0,
    returned: row?.returned ?? 0,
  };
}
