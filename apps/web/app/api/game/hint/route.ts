// C1.4 — `POST /api/game/hint`: billed on call, monotonic, billed once.
import { handleHint } from '../../../../src/game/hint.js';
import { sessionContext } from '../../../../src/game/wiring.js';

/** Reads cookies and writes a purchase. Nothing here is prerenderable. */
export const dynamic = 'force-dynamic';

export function POST(request: Request): Promise<Response> {
  return handleHint(sessionContext(), request);
}
