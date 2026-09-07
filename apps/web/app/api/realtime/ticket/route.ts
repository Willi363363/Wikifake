// `/api/realtime/ticket` — step E.3b.2.
//
// The one place the web application says who a socket belongs to. It reads the
// session — which only it can — and signs a short statement the realtime
// service can check with the secret they both already hold.
//
// **It creates a guest if there is none**, through the same `identify` the solo
// route uses. That is not a convenience: 4.3's whole design is that a guest
// holds a real anonymous `user` row so the games they play follow them into an
// account created later, and a room player who was never given one is a round
// that can never be attached. Solo has worked this way since phase 4; this is
// multiplayer catching up.
//
// The cookies it may need to set travel back on the response, exactly as they
// do from `/api/game/start`.
import { decode, playerName, roomCode } from '@wikifake/protocol';
import { mintTicket } from '@wikifake/tickets';
import { loadEnv } from '@wikifake/env';

import { auth } from '../../../../src/auth/auth.js';
import { identify } from '../../../../src/game/player.js';

/** Never prerendered, never cached: it reads a cookie and signs a clock. */
export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  const asked = new URL(request.url);
  const room = decode(roomCode, asked.searchParams.get('room'));
  const name = decode(playerName, asked.searchParams.get('name'));

  // Refused rather than answered with an unusable ticket: a ticket is bound to
  // a room and a nickname, and one minted for values the socket will not carry
  // is a ticket that silently never verifies.
  if (!room.ok || !name.ok) {
    return new Response(null, { status: 400 });
  }

  const env = loadEnv();
  const { player, setCookies } = await identify(auth(), request);

  // `identify` always yields an identity — an account's or a fresh guest's — so
  // there is no unattributed case left to answer for here.
  const ticket = mintTicket(
    env.BETTER_AUTH_SECRET,
    { userId: player.userId as string, roomCode: room.value, playerName: name.value },
    Date.now(),
  );

  const headers = new Headers({ 'content-type': 'application/json' });
  for (const cookie of setCookies) headers.append('set-cookie', cookie);

  return new Response(JSON.stringify({ ticket }), { headers });
}
