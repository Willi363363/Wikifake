// E.3.2 — `POST /api/account/pseudonym`: the name other players see.
//
// Wiring and nothing else, like every other route file: what it does lives in
// `src/account/claim.ts`, which takes its collaborators as arguments so a test
// drives the real handler against a real database.
import { handleClaimPseudonym } from '../../../../src/account/claim.js';
import { auth } from '../../../../src/auth/auth.js';
import { db } from '../../../../src/game/wiring.js';

/** Reads a cookie and writes a row. Nothing here is prerenderable. */
export const dynamic = 'force-dynamic';

export function POST(request: Request): Promise<Response> {
  return handleClaimPseudonym({ auth: auth(), db: db() }, request);
}
