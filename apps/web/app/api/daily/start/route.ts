// N.7 — `POST /api/daily/start`: a round on the article of the day.
//
// Wiring and nothing else, like `api/game/start`. What the route does lives in
// `src/daily/start.ts`, which takes its collaborators as arguments so a test can
// drive the real handler with a frozen page and a mocked model.
import { handleDailyStart } from '../../../../src/daily/wiring.js';

/** Reads cookies, writes rows, and may call a model. Nothing is prerenderable. */
export const dynamic = 'force-dynamic';

export function POST(request: Request): Promise<Response> {
  return handleDailyStart(request);
}
