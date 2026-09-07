// Fetching the statement that says which account a socket belongs to.
//
// Step E.3b.2. The browser cannot mint one — that is the point — so it asks the
// web application, which reads the session and signs. What comes back is opaque
// here: this file carries a string from one place to another and never looks
// inside it.
//
// **A failure is not an error.** No ticket means the round is played
// unattributed, which is exactly what every multiplayer round did until this
// step, so a socket that could not get one still connects and still plays. The
// alternative — refusing to open a room because a statistics counter cannot be
// credited — would trade a whole feature for a number.

/** Where the web application signs one. Bound to the room and the nickname. */
export function ticketUrl(roomCode: string, playerName: string): string {
  const query = new URLSearchParams({ room: roomCode, name: playerName });
  return `/api/realtime/ticket?${query.toString()}`;
}

/**
 * The signed ticket for this player in this room, or an empty string.
 *
 * `POST`, because it may create a guest identity and set a cookie — a `GET`
 * that writes is one a browser or a proxy is entitled to repeat, prefetch or
 * cache.
 */
export async function fetchTicket(roomCode: string, playerName: string): Promise<string> {
  try {
    const answer = await fetch(ticketUrl(roomCode, playerName), { method: 'POST' });
    if (!answer.ok) return '';

    const body: unknown = await answer.json();
    const ticket = (body as { ticket?: unknown }).ticket;
    return typeof ticket === 'string' ? ticket : '';
  } catch {
    return '';
  }
}
