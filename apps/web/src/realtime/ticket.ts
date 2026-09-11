// Fetching the statement that says which account a socket belongs to.
//
// Step E.3b.2. The browser cannot mint one — that is the point — so it asks the
// web application, which reads the session and signs. What comes back is opaque
// here: this file carries a string from one place to another and never looks
// inside it.
//
// **Step E.3.3 — and it carries a nickname back as well.** The name in the URL
// is what the browser would *like* to be called; the one in the answer is what
// the server decided, and for a signed-in account that is their pseudonym
// whatever was asked for. The caller has to use what came back: a socket opened
// under one name with a ticket minted for another verifies as neither.
//
// **A failure is not an error.** No ticket means the round is played
// unattributed, which is exactly what every multiplayer round did until E.3b.2,
// so a socket that could not get one still connects and still plays under the
// name it asked for. The alternative — refusing to open a room because a
// statistics counter cannot be credited — would trade a whole feature for a
// number.
import { decode, ticketsApi } from '@wikifake/protocol';

/** Where the web application signs one. Bound to the room and the nickname. */
export function ticketUrl(roomCode: string, playerName: string): string {
  const query = new URLSearchParams({ room: roomCode, name: playerName });
  return `/api/realtime/ticket?${query.toString()}`;
}

/** What the server answered: a ticket, and the name it was minted for. */
export interface Identity {
  /** Empty when there is none, which is a round played unattributed. */
  readonly ticket: string;
  readonly playerName: string;
}

/**
 * The identity for this player in this room.
 *
 * `POST`, because it may create a guest identity and set a cookie — a `GET`
 * that writes is one a browser or a proxy is entitled to repeat, prefetch or
 * cache.
 *
 * On any failure the requested name comes straight back with no ticket, so the
 * caller has one shape to handle and the player still gets into the room.
 */
export async function fetchIdentity(
  roomCode: string,
  playerName: string,
): Promise<Identity> {
  const unattributed: Identity = { ticket: '', playerName };

  try {
    const answer = await fetch(ticketUrl(roomCode, playerName), { method: 'POST' });
    if (!answer.ok) return unattributed;

    const read = decode(ticketsApi.realtimeTicketResponse, await answer.json());
    // A 200 that is not the contract is a broken deployment, and taking a name
    // out of it would be taking a name from a payload nothing validated.
    return read.ok ? read.value : unattributed;
  } catch {
    return unattributed;
  }
}
