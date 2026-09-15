// N.4 — `POST /api/cron/daily`: make sure today has an article.
//
// Wiring and nothing else, like `api/cron/quests`. What the route does lives in
// `src/daily/cron-handler.ts`, which takes its collaborators as arguments.
import { dailyCronContext, handleDailyCron } from '../../../../src/daily/cron-handler.js';

/** Reads a secret, writes rows, may call a model. Nothing is prerenderable. */
export const dynamic = 'force-dynamic';

export function POST(request: Request): Promise<Response> {
  return handleDailyCron(dailyCronContext(), request);
}
