// C1.2, C1.3 — `POST /api/game/submit`: the server grades, and only then does
// the solution leave.
import { handleSubmit } from '../../../../src/game/submit.js';
import { submitContext } from '../../../../src/game/wiring.js';

/** Reads cookies, grades a round, ends it. Nothing here is prerenderable. */
export const dynamic = 'force-dynamic';

export function POST(request: Request): Promise<Response> {
  return handleSubmit(submitContext(), request);
}
