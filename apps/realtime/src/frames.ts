// C5.3, C5.7 — what arrives on the socket, and what it is allowed to be.
//
// Three outcomes, not two. A frame can be too big (the connection closes), it
// can be unreadable (the connection **survives** and the client is told), or it
// can be a message nobody handles (ignored in silence). Collapsing the last two
// is what would break C5.3: closing on a client one version ahead would drop a
// player for sending a message we simply do not know yet.
import { decode, incomingMessage, type IncomingMessage } from '@wikifake/protocol';

/** C5.7 — a frame bigger than this is not a move in a game. */
export const MAX_FRAME_CHARS = 64_000;

/** RFC 6455 — the close codes this service uses. */
export const CLOSE_POLICY_VIOLATION = 1008;
export const CLOSE_MESSAGE_TOO_BIG = 1009;

export type Frame =
  | { readonly kind: 'message'; readonly message: IncomingMessage }
  /** C5.7 — close, do not answer. There is nothing to say to a flood. */
  | { readonly kind: 'too_big'; readonly chars: number }
  /** C5.3 — answer `bad_json` and keep the connection. */
  | { readonly kind: 'unreadable'; readonly detail: string }
  /**
   * C5.3 — a type this server does not handle. Ignored in silence, as today.
   *
   * Silence rather than an error because the alternative is worse in both
   * directions: a client one version ahead would be flooded with rejections for
   * a message it is entitled to try, and a client one version behind would learn
   * nothing useful from them.
   */
  | { readonly kind: 'unknown' };

/**
 * Reads a frame.
 *
 * The size is checked on the raw text before anything is parsed: `JSON.parse` on
 * a megabyte is work done on behalf of whoever sent it.
 */
export function readFrame(raw: string): Frame {
  if (raw.length > MAX_FRAME_CHARS) return { kind: 'too_big', chars: raw.length };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    return {
      kind: 'unreadable',
      detail: error instanceof Error ? error.message : 'not JSON',
    };
  }

  // A discriminated union answers "no such type" and "that type, malformed"
  // with the same failure, and they are not the same event: one is a client we
  // do not understand, the other is a client we do understand sending rubbish.
  // Told apart on the discriminant, before the schema.
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { kind: 'unreadable', detail: 'a message is an object' };
  }

  const type = (parsed as { type?: unknown }).type;
  if (typeof type !== 'string' || !isKnown(type)) return { kind: 'unknown' };

  const message = decode(incomingMessage, parsed);
  return message.ok
    ? { kind: 'message', message: message.value }
    : { kind: 'unreadable', detail: message.issues.join('; ') };
}

const KNOWN = new Set<string>(
  incomingMessage.options.map((option) => option.shape.type.value),
);

function isKnown(type: string): boolean {
  return KNOWN.has(type);
}
