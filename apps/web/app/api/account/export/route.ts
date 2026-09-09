// E.7 — `GET /api/account/export`: everything this application holds about the
// account asking.
//
// Wiring and nothing else; the handler is in `src/account/data.ts`, where a
// test drives it against a real database and a real session.
import { handleExport } from '../../../../src/account/data.js';
import { accountDataContext } from '../../../../src/account/wiring.js';

/** Reads a cookie and a player's whole history. Never cached, never prerendered. */
export const dynamic = 'force-dynamic';

export function GET(request: Request): Promise<Response> {
  return handleExport(accountDataContext(), request);
}
