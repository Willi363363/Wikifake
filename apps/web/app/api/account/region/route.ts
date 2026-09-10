// G.1 — `POST /api/account/region`: the board a player picks for themselves.
//
// Wiring and nothing else; the handler is in `src/account/region.ts`.
import { handleChooseRegion } from '../../../../src/account/region.js';
import { regionContext } from '../../../../src/account/wiring.js';

/** Reads a cookie and writes a column. Never cached, never prerendered. */
export const dynamic = 'force-dynamic';

export function POST(request: Request): Promise<Response> {
  return handleChooseRegion(regionContext(), request);
}
