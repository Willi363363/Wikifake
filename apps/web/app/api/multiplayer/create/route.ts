// C5.6 — `POST /api/multiplayer/create`: a unique six-character code, and a cap.
import { handleCreateRoom } from '../../../../src/game/rooms.js';
import { roomsContext } from '../../../../src/game/wiring.js';

/** Draws a code and writes a row. Nothing here is prerenderable. */
export const dynamic = 'force-dynamic';

export function POST(request: Request): Promise<Response> {
  return handleCreateRoom(roomsContext(), request);
}
