// Starting a solo round: cache, Wikipedia, model, database.
//
// Everything here takes its collaborators as parameters. Not for elegance: it is
// what lets the leak assertion of C1.1 run against the real assembly with a
// mocked model and a frozen page, rather than against a hand-built payload that
// proves the test author knows the contract.
//
// The one rule that is not negotiable in this file: **the solution is never put
// into the response object at all**. `startGameResponse` would strip it, and that
// encoder is the guarantee — but a payload that never held it cannot be leaked
// by a future schema change either.
import {
  fetchRenderedPage,
  generateArticle,
  searchTitles,
  type ArticleCache,
  type CachedArticle,
  type WikiRequest,
  type WikiTransport,
} from '@wikifake/article';
import { createGame, recordLlmCalls, type Database, type NewParticipant } from '@wikifake/db';
import type { ErrorCode, LlmCallRecord, gameApi } from '@wikifake/protocol';
import type { LanguageModel } from 'ai';

type Db = Database['db'];

export interface RoundDependencies {
  readonly db: Db;
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

export interface RoundRequest {
  /** What the player typed. Also the cache category. */
  readonly topic: string;
  readonly timeLimit: number;
  readonly player: NewParticipant;
}

/**
 * A round, or a reason there is none.
 *
 * A failure is a value rather than an exception: a topic with no article is an
 * ordinary outcome of letting players type whatever they like, and the current
 * code wraps three nested `try` blocks around that fact.
 */
export type RoundOutcome =
  | { readonly ok: true; readonly value: gameApi.StartGameResponse }
  | { readonly ok: false; readonly code: ErrorCode; readonly message: string };

/** A round's article, however it was obtained, and whether it cost anything. */
interface Sourced {
  readonly entry: CachedArticle;
  /** C4.6 — reused rather than generated. The denominator of `cacheHitRate`. */
  readonly fromCache: boolean;
  readonly calls: readonly LlmCallRecord[];
}

type SourceOutcome =
  | { readonly ok: true; readonly value: Sourced }
  | { readonly ok: false; readonly code: ErrorCode; readonly message: string; readonly calls: readonly LlmCallRecord[] };

/**
 * The article for this round: from the cache when there is one, generated
 * otherwise.
 *
 * A cache that is down is treated exactly like a miss — the round is generated —
 * and the difference is recorded rather than smoothed over, because a hit rate
 * that silently counts outages measures Redis uptime instead of the cache.
 */
async function sourceArticle(
  dependencies: RoundDependencies,
  topic: string,
): Promise<SourceOutcome> {
  if (dependencies.cache !== null) {
    const lookup = await dependencies.cache.get(topic);
    if (lookup.kind === 'hit') {
      return { ok: true, value: { entry: lookup.entry, fromCache: true, calls: [] } };
    }
  }

  const titles = await searchTitles(topic, dependencies.wiki, dependencies.transport);
  if (!titles.ok) {
    return {
      ok: false,
      code: 'topic_not_found',
      message: `No Wikipedia article matches "${topic}".`,
      calls: [],
    };
  }

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
    return page.reason === 'not_found'
      ? {
          ok: false,
          code: 'topic_not_found',
          message: `No Wikipedia article matches "${topic}".`,
          calls: [],
        }
      : {
          ok: false,
          code: 'generation_failed',
          message: 'Wikipedia could not be read right now.',
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
    // C4.5 — the calls come back on the failing path too. The generation bought
    // nothing, but it was billed, and dropping the record is what makes the cost
    // of failure invisible today.
    return {
      ok: false,
      code: 'generation_failed',
      message: `The article about "${topic}" could not be falsified.`,
      calls: report.calls,
    };
  }

  const generated = report.result.value;
  const entry: CachedArticle = {
    article: generated.article,
    solution: [...generated.solution],
    html: generated.html,
  };

  // C3.7 — only a successful generation is cached, and a cache that refuses the
  // write costs the round nothing: `put` reports, it does not throw.
  if (dependencies.cache !== null) await dependencies.cache.put(topic, entry);

  return { ok: true, value: { entry, fromCache: false, calls: report.calls } };
}

/**
 * Starts a solo round and returns what the player may see.
 *
 * The session handle is the game's own identifier. It is not a bearer token and
 * is not treated as a secret: the routes that follow authorise on the session
 * cookie — is this caller a participant of that game — which is what the Python's
 * `secrets.token_urlsafe(12)` was standing in for, badly, from an in-memory
 * registry that a restart emptied.
 */
export async function startRound(
  dependencies: RoundDependencies,
  request: RoundRequest,
): Promise<RoundOutcome> {
  const sourced = await sourceArticle(dependencies, request.topic);

  if (!sourced.ok) {
    await recordLlmCalls(dependencies.db, sourced.calls, null);
    return { ok: false, code: sourced.code, message: sourced.message };
  }

  const { entry, fromCache, calls } = sourced.value;

  const started = await createGame(dependencies.db, {
    mode: 'solo',
    topic: entry.article.topic,
    sourceUrl: entry.article.wikipediaUrl,
    paragraphs: entry.article.paragraphs,
    timeLimit: request.timeLimit,
    fromCache,
    solution: entry.solution,
    players: [request.player],
  });

  // After the game exists, so the calls carry the game they produced: "what did
  // this round cost" is a query rather than a reconciliation.
  await recordLlmCalls(dependencies.db, calls, started.gameId);

  return {
    ok: true,
    value: {
      sessionId: started.gameId,
      timeLimit: request.timeLimit,
      // Spread from `article`, which is the `articleView` shape and nothing more.
      // The solution is in `entry.solution`, and it is not mentioned here.
      ...entry.article,
    },
  };
}
