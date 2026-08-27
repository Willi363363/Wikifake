// C4.6 — `GET /api/usage`: what a game costs.
//
// The endpoint answers one question — is an advertising model plausible — and
// the only calculation that settles it is revenue per game against cost per
// game. The second was invisible before `usage.py` existed, and is volatile
// while it does: the counters are in a process and restart at zero on every
// deployment, so the number is only ever an order of magnitude for the last few
// hours.
//
// Here they are queried from `llm_call`, so they survive a restart, a second
// instance, and the deployment that happens between two measurements.
//
// Public, as it is today. It carries no article, no solution and no identity —
// only what the model was asked and what it answered with.
import {
  readUsageByKind,
  readUsageTotals,
  usageReport,
  type Database,
} from '@wikifake/db';
import { healthApi } from '@wikifake/protocol';
import type { ArticleCache } from '@wikifake/article';

import { json } from '../respond.js';

export interface UsageContext {
  readonly db: Database['db'];
  /** Null when this deployment runs without a cache at all. */
  readonly cache: ArticleCache | null;
}

export async function handleUsage(context: UsageContext): Promise<Response> {
  const [totals, byKind, cache] = await Promise.all([
    readUsageTotals(context.db),
    readUsageByKind(context.db),
    // Never throws: an unreachable cache answers `null`, which the contract can
    // now say. Serving zeroes instead would read as "the cache is empty,
    // generation is expensive" — a wrong answer to the question above.
    context.cache === null ? Promise.resolve(null) : context.cache.stats(),
  ]);

  const report = usageReport(totals);

  return json(healthApi.usageResponse, {
    usage: {
      gamesGenerated: totals.gamesGenerated,
      gamesServedFromCache: totals.gamesFromCache,
      byKind,
      totals: report.totals,
      perGeneratedGame: report.perGeneratedGame,
      cacheHitRate: report.cacheHitRate,
    },
    cache,
  });
}
