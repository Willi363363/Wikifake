// C5.1, C5.2 — who is allowed onto a socket, and what they are told when they
// are not.
//
// The URL is `/ws/:roomCode/:playerName`, as today. What changes is that the
// nickname arrives **percent-encoded**: the server's own regex allows spaces and
// accented letters, and the current client interpolates the raw name into the
// path, so a nickname with a space either does not arrive or arrives mangled.
// The name is decoded here and validated by the contract's own schema, so "what
// a nickname is" has one definition.
import { playerName, roomCode, type ErrorCode } from '@wikifake/protocol';

export interface Credentials {
  readonly roomCode: string;
  readonly playerName: string;
}

export type Handshake =
  | { readonly ok: true; readonly credentials: Credentials }
  | { readonly ok: false; readonly code: ErrorCode; readonly message: string };

/**
 * The two path segments, or a typed refusal.
 *
 * A refusal carries a code the client can branch on, and the message leaves
 * **before** the close (C5.1): a socket closed without a word is
 * indistinguishable from a network failure, and the player is shown "connection
 * lost" for what was a rejected nickname.
 */
export function readHandshake(url: string): Handshake {
  const path = new URL(url, 'ws://realtime.invalid').pathname;
  const segments = path.split('/').filter((segment) => segment !== '');

  if (segments.length !== 3 || segments[0] !== 'ws') {
    return { ok: false, code: 'room_not_found', message: 'This is not a room.' };
  }

  const room = roomCode.safeParse(segments[1]);
  if (!room.success) {
    return { ok: false, code: 'room_not_found', message: 'This is not a room code.' };
  }

  // Decoded before validating, so the schema judges the nickname the player
  // typed rather than its escaping. A malformed escape is a refused nickname,
  // not a crash: `decodeURIComponent` throws on a stray percent sign.
  let decoded: string;
  try {
    decoded = decodeURIComponent(segments[2] ?? '');
  } catch {
    return { ok: false, code: 'invalid_name', message: 'That nickname is not readable.' };
  }

  const name = playerName.safeParse(decoded);
  if (!name.success) {
    return {
      ok: false,
      code: 'invalid_name',
      // The schema's own message: one definition of what a nickname is, and one
      // sentence explaining it.
      message: name.error.issues[0]?.message ?? 'That nickname is not allowed.',
    };
  }

  return { ok: true, credentials: { roomCode: room.data, playerName: name.data } };
}
