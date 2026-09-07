// Step E.3b.1 — a multiplayer round, written down.
//
// The one place this service turns a `record_results` effect into rows. Before
// it, `apps/realtime` created a `game` and its `participant`s and then never
// touched either again: every multiplayer round in Postgres was a game nobody
// finished — no `submitted_at`, no score, no `ended_at` — and `player_stats`
// counted none of it.
//
// **It writes what the rules decided and decides nothing.** The scores, the
// breakdowns, the marks and the streak answer all come in on the effect, graded
// by `@wikifake/domain` where every other score in this application is graded.
// What is added here is the one thing the rules may not have: a clock.
import { recordSubmission, type Database } from '@wikifake/db';

import type { RecordResults } from './service.js';

export interface ResultsDependencies {
  readonly db: Database['db'];
  /** Injected, because `purity.test.ts` is right that a rule may not read one. */
  readonly now: () => Date;
}

/**
 * Writes one round.
 *
 * `recordSubmission` per player, and each is the same call the solo route
 * makes — the same transaction, the same conditional update, the same
 * `player_stats` increment hanging off it. One function, so multiplayer cannot
 * drift from solo about what settling a round means.
 *
 * **Sequential rather than `Promise.all`.** Each call opens a transaction, and
 * every one of them updates the same `game` row's `ended_at`; four of those at
 * once on Postgres is four transactions contending for one row, which is a
 * deadlock waiting for a busy evening rather than a speed-up. A room holds
 * eight players at most.
 *
 * A failure is **logged and swallowed** by the caller rather than thrown here:
 * the round is over for the players either way, the debrief is already on its
 * way to them over the channel, and an exception thrown into the settle loop
 * would take the room down over a row.
 */
export async function writeResults(
  dependencies: ResultsDependencies,
  effect: RecordResults,
): Promise<void> {
  const at = dependencies.now();

  for (const result of effect.results) {
    await recordSubmission(dependencies.db, {
      gameId: effect.gameId,
      participantId: result.participantId,
      marked: result.marked,
      score: result.score,
      ...result.breakdown,
      perfect: result.perfect,
      at,
    });
  }
}
