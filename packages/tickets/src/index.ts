// Who a socket belongs to — step E.3b.2.
//
// `apps/realtime` needs to know which **account** is behind a player, so that a
// room's rounds count towards their statistics. It cannot ask the browser: a
// client that can say who it is can say it is somebody else, and a `userId` in
// a socket URL would be an invitation to type another one.
//
// So the web application — which holds the session and is the only thing that
// can read it — signs a short statement, the browser carries it, and this
// service checks the signature with a secret they both already have.
//
// **Its own package, and that is the decision this step opened with.** It could
// have lived in `@wikifake/protocol`, which is where the shapes two sides agree
// on live, and the argument against it is one import: this file needs
// `node:crypto`, and `protocol` is bundled into a browser. A subpath export
// would keep it out today and be one careless import away from breaking a build
// with a message about `crypto` that names nothing. A package the browser has
// no reason to depend on cannot be imported into one by accident, and
// `workspace-graph.test.ts` is where that boundary is now visible.
//
// **What a stolen ticket is worth, stated rather than assumed.** It carries no
// session and grants no access: presenting one lets a socket say *this round is
// mine*. It is bound to a room **and** to a nickname, and that nickname is
// already defended by D5's own token — so using a stolen one means holding both
// secrets and joining the same room under the same name, at which point the
// theft has bought the ability to play a round on somebody's statistics. Short
// lived on top of that, because there is no reason for it not to be.
import { createHmac, timingSafeEqual } from 'node:crypto';

/** What a ticket says. Nothing here is secret; the signature is what matters. */
export interface Ticket {
  /** The `user` row a round played under this ticket belongs to. */
  readonly userId: string;
  /** The room it may be presented in, and no other. */
  readonly roomCode: string;
  /** The nickname it may be presented under, and no other. */
  readonly playerName: string;
}

/** A ticket, plus when it stops being one. Milliseconds since the epoch. */
interface Signed extends Ticket {
  readonly exp: number;
}

/**
 * How long a freshly minted ticket lasts.
 *
 * Ten minutes: long enough to open a socket, lose it, and reconnect through the
 * retry loop without going back for another; short enough that one left in a
 * log is worthless by the time anybody reads it.
 *
 * The identity is captured when a player **joins**, and `createGame` runs after
 * that, so a ticket does not need to outlive the round it is played in — only
 * the joining.
 */
export const TICKET_TTL_MS = 10 * 60 * 1000;

function base64url(value: Buffer): string {
  return value.toString('base64url');
}

function sign(secret: string, payload: string): string {
  return base64url(createHmac('sha256', secret).update(payload).digest());
}

/**
 * A signed ticket, as it travels in a URL.
 *
 * `payload.signature`, both base64url, so it survives a query string with no
 * escaping and carries no character a log will mangle.
 */
export function mintTicket(
  secret: string,
  ticket: Ticket,
  now: number,
  ttlMs: number = TICKET_TTL_MS,
): string {
  const signed: Signed = { ...ticket, exp: now + ttlMs };
  const payload = base64url(Buffer.from(JSON.stringify(signed), 'utf8'));
  return `${payload}.${sign(secret, payload)}`;
}

/**
 * The ticket a value carries, or **null** for anything wrong with it.
 *
 * One answer for every failure — a bad signature, a stale one, a payload that
 * is not a ticket, a value that is not two parts — because the caller does the
 * same thing in every case: play the round unattributed. A reason here would be
 * a distinction nobody can act on and a hint to whoever is guessing.
 *
 * The room and the nickname are checked **here** rather than by the caller, so
 * that a ticket cannot be verified in one place and its binding checked in
 * another that forgot to.
 */
export function readTicket(
  secret: string,
  value: string,
  expected: { readonly roomCode: string; readonly playerName: string },
  now: number,
): Ticket | null {
  const parts = value.split('.');
  if (parts.length !== 2) return null;

  const [payload, offered] = parts as [string, string];
  const wanted = sign(secret, payload);

  // Constant time, and length-checked first because `timingSafeEqual` throws on
  // a mismatch rather than returning false. A comparison that returned early on
  // the first wrong byte would leak the signature one byte at a time.
  const a = Buffer.from(offered, 'utf8');
  const b = Buffer.from(wanted, 'utf8');
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  let signed: Signed;
  try {
    signed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Signed;
  } catch {
    return null;
  }

  if (typeof signed.userId !== 'string' || signed.userId === '') return null;
  if (typeof signed.exp !== 'number' || signed.exp <= now) return null;
  if (signed.roomCode !== expected.roomCode) return null;
  if (signed.playerName !== expected.playerName) return null;

  return {
    userId: signed.userId,
    roomCode: signed.roomCode,
    playerName: signed.playerName,
  };
}
