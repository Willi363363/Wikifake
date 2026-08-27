// The probes: `GET /ping`, `GET /api/health`, `GET /api/usage`.
import { z } from 'zod';

import { llmCallKind } from '../accounting.js';

/**
 * C7.1 — `GET /ping` answers **exactly** this. Load balancers read it, and the
 * literal is the contract: `z.literal` rather than `z.string`.
 */
export const pingResponse = z.object({ status: z.literal('alive') });
export type PingResponse = z.infer<typeof pingResponse>;

/**
 * C7.2 — `GET /api/health`, field for field.
 *
 * The CI deployment probe reads `commit` and compares it to the pushed SHA
 * (`.github/workflows/deploy-check.yml`). If this contract breaks, the
 * verification loop stops verifying and says nothing — so `commit` keeps its
 * name, and stays a **string present even when empty**: only the platform
 * provides it, and locally there is none. Optional would let the probe read
 * `undefined` and wait forever.
 *
 * `llmConfigured` says whether generation can work. The API key itself never
 * appears — there is no field for it, so there is nothing to leak.
 */
export const healthResponse = z.object({
  status: z.literal('ok'),
  version: z.string().min(1),
  commit: z.string(),
  commitShort: z.string().max(7),
  model: z.string().min(1),
  llmConfigured: z.boolean(),
});
export type HealthResponse = z.infer<typeof healthResponse>;

/** Per-kind model call counters, keyed by `llmCallKind`. */
const callCounter = z.object({
  calls: z.number().int().min(0),
  failures: z.number().int().min(0),
  promptChars: z.number().int().min(0),
  outputChars: z.number().int().min(0),
  inputTokens: z.number().int().min(0),
  outputTokens: z.number().int().min(0),
});

/** Averages over the games actually generated, not diluted by cache hits (C4.6). */
const perGeneratedGame = z.object({
  llmCalls: z.number().min(0),
  inputTokens: z.number().min(0),
  outputTokens: z.number().min(0),
});

/**
 * C4.6 — `GET /api/usage`: what a game costs.
 *
 * `cacheHitRate` and `perGeneratedGame` are the two figures the contract names:
 * the second is the cost of a game *actually generated*, which is the only
 * number an advertising model can be judged against.
 *
 * Phase 2 replaces these volatile counters with the `llm_call` table, so the
 * shape will grow a queryable history. What the contract requires is that these
 * two survive that move.
 */
export const usageResponse = z.object({
  usage: z.object({
    gamesGenerated: z.number().int().min(0),
    gamesServedFromCache: z.number().int().min(0),
    // `partialRecord`: the keys are the three kinds and nothing else, and a
    // kind with no calls yet is absent rather than zero — which is what the
    // current endpoint serves.
    byKind: z.partialRecord(llmCallKind, callCounter),
    totals: z.object({
      llmCalls: z.number().int().min(0),
      inputTokens: z.number().int().min(0),
      outputTokens: z.number().int().min(0),
    }),
    perGeneratedGame,
    cacheHitRate: z.number().min(0).max(1),
  }),
  /**
   * What the cache holds, or `null` when it did not answer.
   *
   * Nullable because an outage is not an empty cache. The current cache is a
   * dictionary in the process, so it always answers; the shared one can be
   * unreachable, and phase 3 went out of its way to keep `unavailable` distinct
   * from a miss for exactly this reason. Serving `articles: 0` instead would
   * read as "the cache is empty, generation is expensive" — a wrong answer to
   * the one question this endpoint exists to settle.
   */
  cache: z
    .object({
      categories: z.number().int().min(0),
      articles: z.number().int().min(0),
      maxCategories: z.number().int().min(1),
      variantsPerCategory: z.number().int().min(1),
      ttlSeconds: z.number().int().min(1),
    })
    .nullable(),
});
export type UsageResponse = z.infer<typeof usageResponse>;
