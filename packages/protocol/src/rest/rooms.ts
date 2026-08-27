// `POST /api/multiplayer/create`.
import { z } from 'zod';

import { roomCode } from '../primitives.js';

/** No body: creating a room takes no argument. */
export const createRoomRequest = z.object({});
export type CreateRoomRequest = z.infer<typeof createRoomRequest>;

/** C5.6 — the join code. Six characters, unique, capped registry. */
export const createRoomResponse = z.object({ roomCode });
export type CreateRoomResponse = z.infer<typeof createRoomResponse>;
