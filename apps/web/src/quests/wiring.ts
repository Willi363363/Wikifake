// The collaborators the quest routes need — steps F.5 and F.6.
//
// Lazily, for the reason `game/wiring.ts` gives: building these validates the
// environment and opens a connection, so at module load importing any route
// under `app/api/quests/` would depend on a reachable database.
import { auth } from '../auth/auth.js';
import { db } from '../game/wiring.js';
import type { ClaimContext } from './claim.js';

/** What claiming needs: who is asking, the rows, and a clock. */
export function claimContext(): ClaimContext {
  return { auth: auth(), db: db(), now: () => new Date() };
}
