// C1.1 — `POST /api/game/start`: the article, and how many paragraphs were
// falsified. Never which ones.
//
// This file is wiring and nothing else. What the route *does* lives in
// `src/game/start.ts`, which takes its collaborators as arguments so the leak
// assertion can drive the real handler with a frozen page and a mocked model.
import { handleStart } from '../../../../src/game/start.js';
import { startContext } from '../../../../src/game/wiring.js';

/** Reads cookies, writes rows, calls a model. Nothing here is prerenderable. */
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
  return handleStart(startContext(), request);
}
