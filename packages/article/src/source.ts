// One article for one topic: the cache, then Wikipedia, then the model.
//
// This chain existed once, in `apps/web`, for the solo round. Multiplayer needs
// exactly the same chain and nothing else — the same cache, the same first hit,
// the same falsification, the same accounting — so it lives here, where the
// three pieces it joins already live. Two copies of "how a round gets its
// article" would be two answers to C3.7 and to C4.5, and nothing would make them
// agree.
//
// What is deliberately *not* here: what the failure is called to a caller, and
// what is written to the database. A REST route answers an `ErrorCode`, a socket
// answers `article_failed`, and neither belongs to the piece that reads
// Wikipedia.
import type { LanguageModel } from 'ai';
import type { LlmCallRecord } from '@wikifake/protocol';

import { fetchRenderedPage, searchTitles } from './mediawiki.js';
import { generateArticle } from './generate.js';
import type { ArticleCache, CachedArticle } from './cache/cache.js';
import type { WikiRequest, WikiTransport } from './mediawiki.js';

export interface SourceDependencies {
  /** Null when this deployment runs without a cache: every round is generated. */
  readonly cache: ArticleCache | null;
  readonly model: LanguageModel;
  readonly wiki: WikiRequest;
  readonly transport: WikiTransport;
  /**
   * Which paragraphs get falsified. A parameter, so a test pins the draw — the
   * same reason `generateArticle` takes it rather than calling `Math.random`.
   */
  readonly seed: () => number;
}

/** A round's article, however it was obtained, and whether it cost anything. */
export interface SourcedArticle {
  readonly entry: CachedArticle;
  /** C4.6 — reused rather than generated. The denominator of `cacheHitRate`. */
  readonly fromCache: boolean;
  readonly calls: readonly LlmCallRecord[];
}

/**
 * Why there is no article.
 *
 * Three, not one, because the callers do different things with them: a topic
 * nobody wrote about means try the next candidate, and Wikipedia being
 * unreachable means the next candidate will fail too.
 */
export type SourceFailure =
  /** No page matches. C3.7 — an ordinary outcome, not an exception. */
  | 'topic_not_found'
  /** Wikipedia answered nothing, or nothing we understand. */
  | 'wikipedia_unreachable'
  /** There is a page, and the model could not falsify it. */
  | 'falsification_failed';

export type SourceOutcome =
  | { readonly ok: true; readonly value: SourcedArticle }
  | {
      readonly ok: false;
      readonly reason: SourceFailure;
      /**
       * C4.5 — the calls come back on the failing path too. The generation
       * bought nothing, but it was billed, and dropping the record is what makes
       * the cost of failure invisible today.
       */
      readonly calls: readonly LlmCallRecord[];
    };

/**
 * The article for this topic: from the cache when there is one, generated
 * otherwise.
 *
 * A cache that is down is treated exactly like a miss — the round is generated —
 * and the difference is recorded rather than smoothed over, because a hit rate
 * that silently counts outages measures Redis uptime instead of the cache.
 */
export async function sourceArticle(
  dependencies: SourceDependencies,
  topic: string,
): Promise<SourceOutcome> {
  if (dependencies.cache !== null) {
    const lookup = await dependencies.cache.get(topic);
    if (lookup.kind === 'hit') {
      return { ok: true, value: { entry: lookup.entry, fromCache: true, calls: [] } };
    }
  }

  const titles = await searchTitles(topic, dependencies.wiki, dependencies.transport);
  if (!titles.ok) return { ok: false, reason: 'topic_not_found', calls: [] };

  // The first hit, and no auto-suggestion beyond it. `fetchRenderedPage` resolves
  // the exact title: the Python asked for `results[0]` without disabling the
  // library's guessing, so a lookup could land on an article nobody chose and the
  // player be graded on it.
  const [best] = titles.value;
  const page = await fetchRenderedPage(
    best ?? topic,
    dependencies.wiki,
    dependencies.transport,
  );
  if (!page.ok) {
    return {
      ok: false,
      reason: page.reason === 'not_found' ? 'topic_not_found' : 'wikipedia_unreachable',
      calls: [],
    };
  }

  const report = await generateArticle({
    html: page.value.html,
    // The resolved page title, not what the player typed: it is what the article
    // is actually about, and what the debrief will name.
    topic: page.value.title,
    sourceUrl: page.value.url,
    model: dependencies.model,
    seed: dependencies.seed(),
  });

  if (!report.result.ok) {
    return { ok: false, reason: 'falsification_failed', calls: report.calls };
  }

  const generated = report.result.value;
  const entry: CachedArticle = {
    article: generated.article,
    solution: [...generated.solution],
    html: generated.html,
  };

  // C3.7, C4.5 — only a successful generation is cached, and a cache that
  // refuses the write costs the round nothing: `put` reports, it does not throw.
  if (dependencies.cache !== null) await dependencies.cache.put(topic, entry);

  return { ok: true, value: { entry, fromCache: false, calls: report.calls } };
}
