// N.4 — `GET /api/cron/daily`: make sure today has an article.
//
// **A `GET` that writes**, like `cron/quests` beside it, and for the same reason
// it gives: Vercel's scheduler issues one, so the method is dictated rather than
// chosen — and a `POST` beside it would be a second door onto the same room.
// This file shipped as a `POST` first, and `route-parity.test.ts` is what said
// so before the schedule could fail silently every morning at 00:10.
//
// Wiring and nothing else. What the route does lives in `src/daily/cron-handler.ts`.
import { dailyCronContext, handleDailyCron } from '../../../../src/daily/cron-handler.js';

/** Reads a secret, writes rows, may call a model. Nothing is prerenderable. */
export const dynamic = 'force-dynamic';

/**
 * Step O.4 — the ceiling the platform enforces, above the chain's own deadline.
 *
 * `GENERATION_DEADLINE_MS` is forty-five seconds and it is the one that should
 * fire: it ends in a refusal the player can read, and the model call it aborts
 * is still billed and still recorded. This is the backstop under it — a request
 * that somehow outlives its own deadline is cut by the platform rather than
 * held to its default, which is five minutes.
 */
export const maxDuration = 60;

export function GET(request: Request): Promise<Response> {
  return handleDailyCron(dailyCronContext(), request);
}
