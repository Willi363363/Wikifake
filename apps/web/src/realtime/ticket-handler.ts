// `POST /api/realtime/ticket` — steps E.3b.2 and E.3.3.
//
// The one place the web application says who a socket belongs to. It reads the
// session — which only it can — and signs a short statement the realtime
// service can check with the secret they both already hold.
//
// **It creates a guest if there is none**, through the same `identify` the solo
// route uses. That is not a convenience: 4.3's whole design is that a guest
// holds a real anonymous `user` row so the games they play follow them into an
// account created later, and a room player who was never given one is a round
// that can never be attached.
//
// **Step E.3.3 — and it decides the nickname rather than accepting one.** For
// an account that has chosen a pseudonym, the name in the query string is a
// request and the pseudonym is the answer: a room shows a signed-in player
// under the name every other screen shows them under, and under no other. A
// guest keeps the name they typed, because a guest has no pseudonym to be shown
// instead.
//
// **Substituted rather than refused**, and that is the decision this step
// turned on. The common mismatch is not an attack, it is a `sessionStorage`
// nickname left over from playing as a guest before signing up — so refusing
// would un-attribute rounds for exactly the players who have just created an
// account. Answering with the right name fixes the browser instead of punishing
// it, and there is then no mismatch left to refuse.
//
// It lives here rather than in the route file, which is a shell like every
// other: E.3.3 gave it a rule, and a rule belongs where a test can drive it
// against a real database.
import { selectPseudonym, type Database } from '@wikifake/db';
import { decode, playerName, roomCode, ticketsApi } from '@wikifake/protocol';
import { mintTicket } from '@wikifake/tickets';

import type { auth } from '../auth/auth.js';
import { identify } from '../game/player.js';
import { json } from '../respond.js';

export interface TicketContext {
  readonly auth: ReturnType<typeof auth>;
  readonly db: Database['db'];
  readonly secret: string;
  readonly now: () => number;
}

export async function handleTicket(
  context: TicketContext,
  request: Request,
): Promise<Response> {
  const asked = new URL(request.url);
  const room = decode(roomCode, asked.searchParams.get('room'));
  const wanted = decode(playerName, asked.searchParams.get('name'));

  // Refused rather than answered with an unusable ticket: a ticket is bound to
  // a room and a nickname, and one minted for values the socket will not carry
  // is a ticket that silently never verifies.
  if (!room.ok || !wanted.ok) {
    return new Response(null, { status: 400 });
  }

  const { player, setCookies } = await identify(context.auth, request);
  const userId = player.userId as string;

  // A guest has no `profile` row — E.3.2 refuses to give one a pseudonym — so
  // this is null for them and they keep the name they typed. One query answers
  // "is this an account, and has it chosen a name", because the row *is* the
  // answer to both.
  const chosen = await selectPseudonym(context.db, userId);
  const name = chosen?.displayName ?? wanted.value;

  const ticket = mintTicket(
    context.secret,
    { userId, roomCode: room.value, playerName: name },
    context.now(),
  );

  // The cookies a fresh guest needs travel back on the response, exactly as
  // they do from `/api/game/start`. `setCookies` rather than `headers`, because
  // a record cannot hold two of them and a sign-in sends two.
  return json(
    ticketsApi.realtimeTicketResponse,
    { ticket, playerName: name },
    {
      setCookies,
    },
  );
}
