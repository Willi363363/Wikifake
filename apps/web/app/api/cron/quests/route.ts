// F.5 — `POST /api/cron/quests`: the scheduled pre-warm.
//
// Wiring and nothing else; the handler is in `src/quests/handler.ts`, where a
// test drives it against a real database and a real token.
//
// **`GET` only, and it writes.** Vercel's scheduler issues a `GET`, so that is
// the method; a `POST` beside it would be a second door onto the same room, and
// C8.1's catalogue would have to describe both. `force-dynamic` is what keeps a
// writing `GET` from being cached, and the bearer token is what keeps it from
// being called.
import { handleQuestCron, cronHandlerContext } from '../../../../src/quests/handler.js';
import { db } from '../../../../src/game/wiring.js';

/** Reads every active player's rows and writes some. Never cached. */
export const dynamic = 'force-dynamic';

export function GET(request: Request): Promise<Response> {
  return handleQuestCron(cronHandlerContext(db()), request);
}
