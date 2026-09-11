// `POST /api/view`: a page load counted, with nothing on it that names anybody.
import { handleRecordView } from '../../../src/traffic/record.js';
import { db } from '../../../src/game/wiring.js';

/** Writes a row on every call. Nothing here is prerenderable. */
export const dynamic = 'force-dynamic';

export function POST(request: Request): Promise<Response> {
  return handleRecordView({ db: db(), now: () => new Date() }, request);
}
