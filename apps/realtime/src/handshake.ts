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

/**
 * D5 — the secret that says a returning player is the one who left.
 *
 * The **client** owns it: it generates one, keeps it for as long as the tab
 * lives, and sends it on every connection including the first. Nothing is minted
 * server-side and no secret is ever sent down the wire — which is why the
 * protocol grows no message for this.
 *
 * A connection that offers none still plays; what it cannot do is reclaim a
 * nickname afterwards, because there is nothing to prove it is the same player.
 * That fails closed: the alternative is a slot anybody can walk into by typing a
 * nickname, which is worse than today, where a dropped player is deleted and has
 * nothing left to steal.
 */
const sessionToken = /^[A-Za-z0-9_-]{16,128}$/;

export interface Credentials {
  readonly roomCode: string;
  readonly playerName: string;
  /** Empty when the client offered none, or offered something malformed. */
  readonly token: string;
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
  const asked = new URL(url, 'ws://realtime.invalid');
  const segments = asked.pathname.split('/').filter((segment) => segment !== '');

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

  // A malformed token is dropped rather than refused: it is not a credential the
  // player typed, and answering `invalid_name` for a mangled query parameter
  // would tell them their nickname is wrong. Without one they still get in — and
  // still cannot reclaim a nickname later.
  const offered = asked.searchParams.get('token') ?? '';
  const token = sessionToken.test(offered) ? offered : '';

  return {
    ok: true,
    credentials: { roomCode: room.data, playerName: name.data, token },
  };
}
