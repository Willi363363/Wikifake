// Which articles are drawn, and what generation cost in failures — step I.7.
//
// Two tables answer this between them: `game` says what was played and whether
// it came from the cache, and `llm_call` says what the model was asked and how
// often it refused. Nothing new is recorded.
//
// **The cache hit rate is C4.6's own figure**, and it is the one number on this
// section that decides the cost of everything else: a cached game is free, so
// the rate is what stands between a hundred rounds and a hundred generations.
import { and, eq, gte, lt, sql, type SQL } from 'drizzle-orm';

import type { Database } from '../client.js';
import { game } from '../schema/game.js';
import { llmCall } from '../schema/usage.js';

type Tx = Parameters<Parameters<Database['db']['transaction']>[0]>[0];
type Db = Database['db'] | Tx;

/** I.8's window, or null for everything. `admin-games.ts` defines the shape. */
export interface Window {
  readonly fromMs: number;
  readonly toMs: number;
}

function startedWithin(window: Window | null): SQL | undefined {
  if (window === null) return undefined;
  return and(
    gte(game.startedAt, new Date(window.fromMs)),
    lt(game.startedAt, new Date(window.toMs)),
  );
}

function calledWithin(window: Window | null): SQL | undefined {
  if (window === null) return undefined;
  return and(
    gte(llmCall.createdAt, new Date(window.fromMs)),
    lt(llmCall.createdAt, new Date(window.toMs)),
  );
}

export interface CacheCounts {
  /** Every round that reached a player. */
  readonly games: number;
  /** …served from a cached article. */
  readonly fromCache: number;
}

/**
 * How many rounds came from the cache.
 *
 * One pass over `game`, which is a scan by construction: counting every row is
 * what the question is. No index removes that, and saying so is better than an
 * index that looks like it helps.
 */
export async function countCacheHits(
  db: Db,
  window: Window | null,
): Promise<CacheCounts> {
  const [row] = await db
    .select({
      games: sql<number>`count(*)::int`,
      fromCache: sql<number>`count(*) filter (where ${game.fromCache})::int`,
    })
    .from(game)
    .where(startedWithin(window));

  return { games: row?.games ?? 0, fromCache: row?.fromCache ?? 0 };
}

export interface TopicCount {
  readonly topic: string;
  readonly games: number;
  /** How many of those were served from the cache rather than generated. */
  readonly fromCache: number;
}

/**
 * The topics played most, with how often each was already in the cache.
 *
 * **The two columns together are the point.** A topic played forty times and
 * cached thirty-nine is the cache working; the same topic cached twice is a
 * cache that is not holding what people ask for, and the totals alone cannot
 * tell those apart.
 *
 * A total order — games, then the topic — so two reads return the same list.
 * `topic` is the article's title as the game stored it, which is what a player
 * typed or a room voted for.
 */
export async function selectTopTopics(
  db: Db,
  window: Window | null,
  limit: number,
): Promise<readonly TopicCount[]> {
  return db
    .select({
      topic: game.topic,
      games: sql<number>`count(*)::int`,
      fromCache: sql<number>`count(*) filter (where ${game.fromCache})::int`,
    })
    .from(game)
    .where(startedWithin(window))
    .groupBy(game.topic)
    .orderBy(sql`count(*) desc`, game.topic)
    .limit(limit);
}

export interface GenerationFailures {
  /** Calls asking the model to falsify an article. */
  readonly falsificationCalls: number;
  readonly falsificationFailed: number;
  /** Calls asking the model to choose a topic. */
  readonly topicCalls: number;
  readonly topicFailed: number;
}

/**
 * How often the model refused, by the two kinds a round depends on.
 *
 * The two fail differently and a single rate would hide it: a topic choice that
 * finds nothing is a player typing something Wikipedia has no article for —
 * ordinary, and not a fault — while a falsification that fails is a round the
 * player waited for and did not get.
 *
 * `flag_verification` is deliberately absent: it is not on the path to a round,
 * and I.6's by-kind table already shows it.
 */
export async function countGenerationFailures(
  db: Db,
  window: Window | null,
): Promise<GenerationFailures> {
  const [row] = await db
    .select({
      falsificationCalls: sql<number>`count(*) filter (where ${llmCall.kind} = 'falsification')::int`,
      falsificationFailed: sql<number>`count(*) filter (where ${llmCall.kind} = 'falsification' and ${llmCall.failed})::int`,
      topicCalls: sql<number>`count(*) filter (where ${llmCall.kind} = 'topic_choice')::int`,
      topicFailed: sql<number>`count(*) filter (where ${llmCall.kind} = 'topic_choice' and ${llmCall.failed})::int`,
    })
    .from(llmCall)
    .where(calledWithin(window));

  return {
    falsificationCalls: row?.falsificationCalls ?? 0,
    falsificationFailed: row?.falsificationFailed ?? 0,
    topicCalls: row?.topicCalls ?? 0,
    topicFailed: row?.topicFailed ?? 0,
  };
}

/** How many distinct articles the game has ever drawn. */
export async function countDistinctTopics(
  db: Db,
  window: Window | null,
): Promise<number> {
  const [row] = await db
    .select({ topics: sql<number>`count(distinct ${game.topic})::int` })
    .from(game)
    .where(startedWithin(window));

  return row?.topics ?? 0;
}

/** Games that were generated rather than served — I.6 divides by this too. */
export async function countGenerated(db: Db, window: Window | null): Promise<number> {
  const [row] = await db
    .select({ games: sql<number>`count(*)::int` })
    .from(game)
    .where(and(eq(game.fromCache, false), startedWithin(window)));

  return row?.games ?? 0;
}
