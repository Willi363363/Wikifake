// The article cache: a shared store instead of a dictionary per process.
//
// What changes with Redis is not the rules, it is who they hold for. Today the
// cache is a `dict` behind a `threading.Lock` (`backend/src/article_cache.py`),
// so two instances share nothing: a deployment throws away everything, and the
// hit rate is per-process. The rules of C4 are the same; they now hold across the
// fleet.
//
// What is **not** cached: the token usage. A game served from the cache cost
// nothing, and replaying the tokens of the generation that filled the entry would
// inflate `perGeneratedGame` by however often the entry was reused — the exact
// dilution C4.6 exists to prevent.
import { articleView, falsifiedPosition } from '@wikifake/protocol';
import { z } from 'zod';

import {
  CACHE_TTL_SECONDS,
  indexKey,
  MAX_CATEGORIES,
  NAMESPACE,
  normaliseCategory,
  turnKey,
  variantsKey,
  VARIANTS_PER_CATEGORY,
} from './keys.js';
import { ENTRY_SEPARATOR, GET_SCRIPT, PUT_SCRIPT, STATS_SCRIPT } from './scripts.js';

/**
 * The one Redis command this package needs.
 *
 * A port rather than a client, for the same reason `mediawiki.ts` takes a
 * `WikiTransport`: the package that produces articles has no business owning a
 * connection, and a driver in its dependencies is a driver every consumer of the
 * contracts drags along. The concrete client is wired in phase 4; the integration
 * tests here pass a real one, because a cache tested against a fake is a fake
 * tested against a fake.
 */
export interface RedisCommands {
  // Mutable arrays, deliberately: a `readonly` parameter here would make the
  // real client fail to satisfy the port, since a method's parameter type has to
  // accept at least what the port promises to pass.
  eval(
    script: string,
    options: { keys: string[]; arguments: string[] },
  ): Promise<unknown>;
}

/** What an entry holds: the round, without what it cost. */
const cachedArticle = z.object({
  article: articleView,
  solution: z.array(falsifiedPosition).min(1),
  html: z.string().min(1),
});

export type CachedArticle = z.infer<typeof cachedArticle>;

/**
 * The outcome of a lookup — three cases, not two.
 *
 * `unavailable` exists because a cache outage is not a miss. Folding it into one
 * would make `cacheHitRate` partly a measure of Redis uptime, and would hide the
 * outage behind a bill for generations that should have been free. The caller
 * treats it like a miss for the purpose of generating, and counts it as neither.
 */
export type CacheLookup =
  | { readonly kind: 'hit'; readonly entry: CachedArticle }
  | { readonly kind: 'miss' }
  | { readonly kind: 'unavailable'; readonly detail: string };

/** Whether a write landed. Never throws into the generation path. */
export type CacheWrite =
  | { readonly kind: 'stored' }
  | { readonly kind: 'ignored' }
  | { readonly kind: 'unavailable'; readonly detail: string };

export interface CacheStats {
  readonly categories: number;
  readonly articles: number;
  readonly maxCategories: number;
  readonly variantsPerCategory: number;
  readonly ttlSeconds: number;
}

export interface CacheOptions {
  readonly redis: RedisCommands;
  /** Injected: the cache is the one place in this package that needs a clock. */
  readonly now: () => number;
  readonly ttlSeconds?: number;
  readonly variantsPerCategory?: number;
  readonly maxCategories?: number;
  /** Defaults to `NAMESPACE`. Set it to keep two deployments off each other's keys. */
  readonly namespace?: string;
}

export interface ArticleCache {
  get(category: string): Promise<CacheLookup>;
  put(category: string, article: CachedArticle): Promise<CacheWrite>;
  stats(): Promise<CacheStats | null>;
}

function detailOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function createArticleCache(options: CacheOptions): ArticleCache {
  const ttlSeconds = options.ttlSeconds ?? CACHE_TTL_SECONDS;
  const variants = options.variantsPerCategory ?? VARIANTS_PER_CATEGORY;
  const maxCategories = options.maxCategories ?? MAX_CATEGORIES;
  const ttlMs = String(ttlSeconds * 1000);
  const namespace = options.namespace ?? NAMESPACE;
  const index = indexKey(namespace);

  return {
    async get(category: string): Promise<CacheLookup> {
      const key = normaliseCategory(category);
      // C4.1 — an empty category is ignored. Not an error: a player who submitted
      // nothing gets a fresh article, and nothing is stored under a blank key.
      if (key === '') return { kind: 'miss' };

      let raw: unknown;
      try {
        raw = await options.redis.eval(GET_SCRIPT, {
          keys: [variantsKey(namespace, key), turnKey(namespace, key), index],
          arguments: [String(options.now()), ttlMs, key],
        });
      } catch (error) {
        return { kind: 'unavailable', detail: detailOf(error) };
      }

      if (typeof raw !== 'string') return { kind: 'miss' };

      const separator = raw.indexOf(ENTRY_SEPARATOR);
      if (separator === -1) return { kind: 'miss' };

      // C4.2 — parsing is the copy. Every reader gets its own object graph, so
      // mutating the result of a `get` affects nothing else: not the store, and
      // not another game holding the same variant. The Python's `_copy` copies
      // three known keys one level deep and shares everything below them.
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw.slice(separator + 1));
      } catch {
        return { kind: 'miss' };
      }

      // An entry written by another deployment is a miss, not a crash. The
      // namespace is versioned to make that rare; the schema makes it harmless.
      const validated = cachedArticle.safeParse(parsed);
      return validated.success
        ? { kind: 'hit', entry: validated.data }
        : { kind: 'miss' };
    },

    async put(category: string, article: CachedArticle): Promise<CacheWrite> {
      const key = normaliseCategory(category);
      if (key === '') return { kind: 'ignored' };

      const now = options.now();
      const entry = `${String(now)}${ENTRY_SEPARATOR}${JSON.stringify(article)}`;

      try {
        await options.redis.eval(PUT_SCRIPT, {
          keys: [variantsKey(namespace, key), turnKey(namespace, key), index],
          arguments: [
            String(now),
            ttlMs,
            key,
            entry,
            String(variants),
            String(maxCategories),
            namespace,
          ],
        });
      } catch (error) {
        return { kind: 'unavailable', detail: detailOf(error) };
      }
      return { kind: 'stored' };
    },

    async stats(): Promise<CacheStats | null> {
      let raw: unknown;
      try {
        raw = await options.redis.eval(STATS_SCRIPT, {
          keys: [index],
          arguments: [String(options.now()), ttlMs, namespace],
        });
      } catch {
        // Null rather than zeroes: "the cache is unreachable" and "the cache is
        // empty" are different facts, and a monitoring endpoint that reports the
        // second for the first is how an outage goes unnoticed.
        return null;
      }

      if (!Array.isArray(raw)) return null;
      return {
        categories: Number(raw[0] ?? 0),
        articles: Number(raw[1] ?? 0),
        maxCategories,
        variantsPerCategory: variants,
        ttlSeconds,
      };
    },
  };
}
