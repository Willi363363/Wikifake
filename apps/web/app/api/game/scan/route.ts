// C1.6 — `POST /api/game/scan`: the SCANNER, resolved by the server.
import { handleScan } from '../../../../src/game/scan.js';
import { sessionContext } from '../../../../src/game/wiring.js';

/** Reads cookies and records a designation. Nothing here is prerenderable. */
export const dynamic = 'force-dynamic';

export function POST(request: Request): Promise<Response> {
  return handleScan(sessionContext(), request);
}
