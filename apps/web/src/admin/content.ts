// Which articles are drawn, and what generation costs in failures — step I.7.
//
// The section that explains the one above it: I.6's spend is a function of how
// often a round has to be generated at all, and that is the cache hit rate.
import {
  countCacheHits,
  countDistinctTopics,
  countGenerated,
  countGenerationFailures,
  selectTopTopics,
  type Database,
  type GenerationFailures,
  type TopicCount,
} from '@wikifake/db';

import { shareOf } from './activation.js';
import { windowOf, type Range } from './range.js';

export interface ContentContext {
  readonly db: Database['db'];
}

/**
 * How many topics the list shows.
 *
 * Fifteen: long enough to see whether play is concentrated on a handful of
 * articles, short enough that nobody scrolls it. It is a sample, not a census —
 * the count of distinct topics beside it is what says how much is missing.
 */
export const TOP_TOPICS = 15;

export interface ContentView {
  readonly games: number;
  readonly fromCache: number;
  readonly generated: number;
  /** Null when no round has been played: no games is not a hit rate of zero. */
  readonly cacheHitRate: number | null;
  readonly distinctTopics: number;
  readonly topics: readonly TopicCount[];
  readonly failures: GenerationFailures;
  /** Null when the model was never asked. */
  readonly falsificationFailureRate: number | null;
  readonly topicFailureRate: number | null;
}

export async function readContent(
  context: ContentContext,
  range: Range,
): Promise<ContentView> {
  const window = windowOf(range);
  const [cache, distinctTopics, topics, failures, generated] = await Promise.all([
    countCacheHits(context.db, window),
    countDistinctTopics(context.db, window),
    selectTopTopics(context.db, window, TOP_TOPICS),
    countGenerationFailures(context.db, window),
    countGenerated(context.db, window),
  ]);

  return {
    games: cache.games,
    fromCache: cache.fromCache,
    generated,
    cacheHitRate: shareOf(cache.fromCache, cache.games),
    distinctTopics,
    topics,
    failures,
    falsificationFailureRate: shareOf(
      failures.falsificationFailed,
      failures.falsificationCalls,
    ),
    topicFailureRate: shareOf(failures.topicFailed, failures.topicCalls),
  };
}
