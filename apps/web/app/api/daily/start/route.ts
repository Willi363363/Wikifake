// N.7 — `POST /api/daily/start`: a round on the article of the day.
//
// Wiring and nothing else, like `api/game/start`. What the route does lives in
// `src/daily/start.ts`, which takes its collaborators as arguments so a test can
// drive the real handler with a frozen page and a mocked model.
import { handleDailyStart } from '../../../../src/daily/wiring.js';

/** Reads cookies, writes rows, and may call a model. Nothing is prerenderable. */
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

export function POST(request: Request): Promise<Response> {
  return handleDailyStart(request);
}
