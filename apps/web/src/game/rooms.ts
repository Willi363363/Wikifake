// C5.6 — `POST /api/multiplayer/create`: a unique six-character code, and a cap.
//
// The room is a row. That is the change: the current registry is a dictionary in
// one process, so a second instance shares no rooms with the first and a
// redeployment ends every game in progress. What drives the room — the socket,
// the phases, the reaper for idle ones — arrives in phase 5; what this route
// owes is a code nobody else holds and a room to join.
//
// Uniqueness is the primary key, not a lookup. `_new_code` checks the dictionary
// before inserting, which is a check a second process defeats: two requests
// drawing the same code a microsecond apart both find it free, and one silently
// overwrites a room in play.
import { insertRoom, selectOpenRoomCount, type Database } from '@wikifake/db';
import {
  DEFAULT_TIME_LIMIT,
  MAX_OPEN_ROOMS,
  ROOM_IDLE_LIMIT_SECONDS,
} from '@wikifake/domain';
import { decode, roomsApi, ROOM_CODE_LENGTH } from '@wikifake/protocol';

import { refuse } from './errors.js';
import { json } from '../respond.js';
import { readJson } from './body.js';

/** C5.6 — upper-case letters and digits, which `roomCode` is the contract for. */
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

/**
 * How many draws before giving up.
 *
 * With 36^6 codes and a cap of two hundred rooms, a collision is already
 * improbable; fifty consecutive ones are not a full registry, they are a broken
 * random source. Carried over from `_new_code` all the same, because giving up
 * is what turns that into a 503 instead of a loop.
 */
const ATTEMPTS = 50;

export interface RoomsContext {
  readonly db: Database['db'];
  /** Injected: a test pins the draw, and a collision becomes reproducible. */
  readonly code: () => string;
  readonly now: () => Date;
}

/** A six-character code, drawn uniformly. */
export function randomCode(): string {
  const bytes = new Uint8Array(ROOM_CODE_LENGTH);
  globalThis.crypto.getRandomValues(bytes);

  return (
    [...bytes]
      // A modulo of 256 by 36 is not quite uniform — the first sixteen letters
      // come up marginally more often. It matters for a key, and a room code is
      // not one: it is guessed against a registry of two hundred, and the codes
      // are drawn afresh rather than derived from anything.
      .map((byte) => ALPHABET[byte % ALPHABET.length] ?? 'A')
      .join('')
  );
}

export async function handleCreateRoom(
  context: RoomsContext,
  request: Request,
): Promise<Response> {
  // Creating a room takes no argument, so a missing body is the ordinary case
  // rather than an error — `readJson` answers null for one, and an empty object
  // is what the contract expects. What is still refused is a body that is
  // something else entirely: a string, a list, a number.
  const parsed = decode(roomsApi.createRoomRequest, (await readJson(request)) ?? {});
  if (!parsed.ok) return refuse('bad_json', parsed.issues.join('; '));

  // Bounded by activity, not by history: counting every room ever created would
  // turn a memory guard into a permanent one, and the two-hundredth room ever
  // opened would be the last. Phase 5 reaps the idle ones (D4); this only reads
  // the same limit.
  const since = new Date(context.now().getTime() - ROOM_IDLE_LIMIT_SECONDS * 1000);
  const [open] = await selectOpenRoomCount(context.db, since);
  if ((open?.open ?? 0) >= MAX_OPEN_ROOMS) {
    return refuse('room_capacity_reached', 'Too many rooms are open. Try again later.');
  }

  for (let attempt = 0; attempt < ATTEMPTS; attempt += 1) {
    const code = context.code();
    if (await insertRoom(context.db, { code, timeLimit: DEFAULT_TIME_LIMIT })) {
      return json(roomsApi.createRoomResponse, { roomCode: code });
    }
  }

  // Fifty collisions in a row. The registry is not full — the draw is broken —
  // but the caller can do nothing with that distinction, and a 503 is the same
  // answer `_new_code` gives.
  return refuse('room_capacity_reached', 'Could not allocate a room code. Try again.');
}
