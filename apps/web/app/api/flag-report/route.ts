// `POST /api/flag-report`: a player reports a genuine error, and it is kept.
import { handleFlagReport } from '../../../src/game/flags.js';
import { flagsContext } from '../../../src/game/wiring.js';

/** Reads cookies, calls a model, writes a row. Nothing here is prerenderable. */
export const dynamic = 'force-dynamic';

export function POST(request: Request): Promise<Response> {
  return handleFlagReport(flagsContext(), request);
}
