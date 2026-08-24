// C4.6 — what a game costs, as a query.
//
// The two figures the contract names: `perGeneratedGame`, the cost of a game
// **actually generated** rather than one averaged over cache hits, and
// `cacheHitRate`. They survived the migration because they are the only numbers
// that answer "does this model pay for itself".
//
// The SQL returns totals; the ratios are computed in TypeScript. Division by
// zero and rounding are easier to be exact about — and to test — outside SQL, and
// a query that returns raw counts is a query a reader can check.
import type { LlmCallRecord } from '@wikifake/protocol';
import { and, count, eq, sql, sum } from 'drizzle-orm';

import type { Database } from '../client.js';
import { game } from '../schema/game.js';
import { llmCall } from '../schema/usage.js';

type Db = Database['db'];

/**
 * Writes what the model calls cost. One place, so "every call writes a row" is a
 * single statement rather than a rule every caller has to remember.
 *
 * C4.5 — a failed call is a row like any other, carrying `failed: true`. What it
 * must not do is become a game, and that is enforced by there being no `game`
 * row rather than by anything here. Losing the row instead is what makes the
 * cost of failure invisible today: `usage.py` drops failures, and
 * `flag_verifier.py` never records its calls at all (D12).
 *
 * @param gameId the game these calls produced, or null — a call made before
 * there is a game, or one that never led to one.
 */
export async function recordLlmCalls(
  db: Db,
  calls: readonly LlmCallRecord[],
  gameId: string | null,
): Promise<void> {
  if (calls.length === 0) return;
  await db.insert(llmCall).values(calls.map((call) => ({ ...call, gameId })));
}

/**
 * Model calls that produced something, by kind.
 *
 * C4.5 — failures are excluded from the cost. A call that failed bought nothing,
 * so averaging it into the price of a game would inflate the number that is
 * supposed to say what a game costs. They are counted separately, because a
 * rising failure rate is its own signal.
 */
export function selectCallsByKind(db: Db) {
  return db
    .select({
      kind: llmCall.kind,
      calls: count(),
      inputTokens: sum(llmCall.inputTokens).mapWith(Number),
      outputTokens: sum(llmCall.outputTokens).mapWith(Number),
      promptChars: sum(llmCall.promptChars).mapWith(Number),
      outputChars: sum(llmCall.outputChars).mapWith(Number),
    })
    .from(llmCall)
    .where(eq(llmCall.failed, false))
    .groupBy(llmCall.kind);
}

/** Failed calls, by kind. A rising failure rate is a signal, not a cost. */
export function selectFailuresByKind(db: Db) {
  return db
    .select({ kind: llmCall.kind, failures: count() })
    .from(llmCall)
    .where(eq(llmCall.failed, true))
    .groupBy(llmCall.kind);
}

/**
 * How many games were generated, and how many were served from the cache.
 *
 * C4.5 — a failed generation never becomes a game, so it is absent from both
 * numbers by construction rather than by being filtered out.
 */
export function selectGameCounts(db: Db) {
  return db
    .select({
      generated: count(sql`case when ${game.fromCache} = false then 1 end`),
      fromCache: count(sql`case when ${game.fromCache} = true then 1 end`),
    })
    .from(game);
}

/** Successful calls and tokens spent on one game. */
export function selectCostOfGame(db: Db, gameId: string) {
  return db
    .select({
      calls: count(),
      inputTokens: sum(llmCall.inputTokens).mapWith(Number),
      outputTokens: sum(llmCall.outputTokens).mapWith(Number),
    })
    .from(llmCall)
    .where(and(eq(llmCall.gameId, gameId), eq(llmCall.failed, false)));
}

export interface UsageTotals {
  readonly calls: number;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly gamesGenerated: number;
  readonly gamesFromCache: number;
}

export interface UsageReport {
  readonly totals: {
    readonly llmCalls: number;
    readonly inputTokens: number;
    readonly outputTokens: number;
  };
  /** C4.6 — per game **generated**, which is what the cost of generation is. */
  readonly perGeneratedGame: {
    readonly llmCalls: number;
    readonly inputTokens: number;
    readonly outputTokens: number;
  };
  readonly cacheHitRate: number;
}

/** Two decimals for calls, one for tokens, three for the rate — as `usage.py`. */
function round(value: number, places: number): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

/**
 * The report `/api/usage` serves, from the totals.
 *
 * Zero games generated gives zero rather than a division by zero: before the
 * first generation there is no cost per game, and saying "0" is closer to the
 * truth than refusing to answer.
 */
export function usageReport(totals: UsageTotals): UsageReport {
  const generated = totals.gamesGenerated;
  const served = generated + totals.gamesFromCache;

  return {
    totals: {
      llmCalls: totals.calls,
      inputTokens: totals.inputTokens,
      outputTokens: totals.outputTokens,
    },
    perGeneratedGame: {
      llmCalls: generated === 0 ? 0 : round(totals.calls / generated, 2),
      inputTokens: generated === 0 ? 0 : round(totals.inputTokens / generated, 1),
      outputTokens: generated === 0 ? 0 : round(totals.outputTokens / generated, 1),
    },
    cacheHitRate: served === 0 ? 0 : round(totals.gamesFromCache / served, 3),
  };
}

/** Everything `usageReport` needs, in two round trips. */
export async function readUsageTotals(db: Db): Promise<UsageTotals> {
  const [byKind, counts] = await Promise.all([
    selectCallsByKind(db),
    selectGameCounts(db),
  ]);

  return {
    calls: byKind.reduce((total, row) => total + row.calls, 0),
    inputTokens: byKind.reduce((total, row) => total + (row.inputTokens ?? 0), 0),
    outputTokens: byKind.reduce((total, row) => total + (row.outputTokens ?? 0), 0),
    gamesGenerated: counts[0]?.generated ?? 0,
    gamesFromCache: counts[0]?.fromCache ?? 0,
  };
}
