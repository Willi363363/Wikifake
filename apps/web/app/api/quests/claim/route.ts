// F.6 — `POST /api/quests/claim`: taking a reward, once.
//
// Wiring and nothing else; the handler is in `src/quests/claim.ts`, where a test
// drives it against a real database and a real session.
import { handleClaimQuest } from '../../../../src/quests/claim.js';
import { claimContext } from '../../../../src/quests/wiring.js';

/** Reads a cookie and writes a row. Never cached, never prerendered. */
export const dynamic = 'force-dynamic';

export function POST(request: Request): Promise<Response> {
  return handleClaimQuest(claimContext(), request);
}
