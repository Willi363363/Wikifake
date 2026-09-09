// E.3b.2 and E.3.3 — `POST /api/realtime/ticket`: who a socket belongs to, and
// under what name.
//
// Wiring and nothing else. What the route *does* lives in
// `src/realtime/ticket-handler.ts`, which takes its collaborators as arguments
// so a test drives the real handler against a real database and a real session.
import { loadEnv } from '@wikifake/env';

import { auth } from '../../../../src/auth/auth.js';
import { db } from '../../../../src/game/wiring.js';
import { handleTicket } from '../../../../src/realtime/ticket-handler.js';

/** Never prerendered, never cached: it reads a cookie and signs a clock. */
export const dynamic = 'force-dynamic';

export function POST(request: Request): Promise<Response> {
  return handleTicket(
    {
      auth: auth(),
      db: db(),
      secret: loadEnv().BETTER_AUTH_SECRET,
      now: () => Date.now(),
    },
    request,
  );
}
