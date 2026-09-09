// `POST /api/realtime/ticket` — step E.3b.2.
//
// The web application says which account a socket belongs to, and signs it. The
// browser cannot mint one and does not read one: it carries the string to the
// realtime service, which is the only other thing holding the secret.
//
// **The room and the nickname are query parameters rather than a body**, and
// that is what a ticket being *bound* means: they are what it is minted for, so
// they belong in the address of the thing rather than inside it. There is no
// request schema for the same reason — nothing is sent.
//
// **Step E.3.3 — the answer carries a nickname too, and it is not always the
// one that was asked for.** The request says *I would like to join as this*;
// the response says *you are joining as this*. For a signed-in account the
// server substitutes their pseudonym, because that is the only name a room may
// show them under. Two fields rather than one because the caller has to use
// what came back: a socket opened under the requested name with a ticket minted
// for another would verify against neither.
import { z } from 'zod';

import { playerName } from '../primitives.js';

/**
 * No body, stated rather than omitted.
 *
 * The catalogue's invariant is that every POST has a request schema, and an
 * empty object is what `createRoomRequest` says for the same situation: the
 * arguments are in the address because they are what the ticket is *bound* to,
 * and nothing else is sent. A route excused from the invariant would be a route
 * nobody validates.
 */
export const realtimeTicketRequest = z.object({});
export type RealtimeTicketRequest = z.infer<typeof realtimeTicketRequest>;

/**
 * The signed statement, opaque to everything that carries it.
 *
 * Two base64url halves separated by a dot: a payload and its signature. The
 * shape is `@wikifake/tickets`', and it is described here only so that the
 * catalogue can say what this route answers with.
 *
 * Never empty. A request that cannot be answered with a ticket is refused
 * rather than answered with an empty one: a client cannot tell "unattributed"
 * from "malformed" by reading a string, and a route that answers 200 with
 * nothing usable is one nobody notices has broken.
 */
export const realtimeTicketResponse = z.object({
  ticket: z.string().min(1),
  /**
   * The nickname the ticket was minted for, and the one the socket must carry.
   *
   * `playerName` and not a bare string: the server chose it, so it is held to
   * the same schema the handshake will hold it to. A pseudonym that could not
   * be a room nickname is a bug E.3.2 already prevents, and this is where it
   * would be caught if it ever stopped being prevented.
   */
  playerName,
});
export type RealtimeTicketResponse = z.infer<typeof realtimeTicketResponse>;
