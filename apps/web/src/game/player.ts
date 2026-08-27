// Who is asking, when the answer may be "nobody yet".
//
// 4.3's rule, applied: a guest is not a degraded mode. Every game route accepts a
// guest participant from the moment it is written, and a guest holds a real
// anonymous `user` row rather than a nickname — that row is what makes the games
// they play follow them into an account created afterwards.
//
// So a request with no session does not get refused and does not get a null
// player: it gets an identity, created here, and the cookie that carries it back.
import { PLAYER_COLOURS } from '@wikifake/domain';
import type { NewParticipant } from '@wikifake/db';

import type { auth } from '../auth/auth.js';

type Auth = ReturnType<typeof auth>;

export interface Identified {
  readonly player: NewParticipant;
  /**
   * What to send back so the browser keeps this identity, or null when it
   * already had one. A guest whose cookie never reaches them is a guest whose
   * next request is a different person.
   */
  readonly setCookies: readonly string[];
}

/**
 * The single colour a solo player wears.
 *
 * Solo has one participant, so there is nothing to tell apart — but the column is
 * `not null` and the debrief renders it, so it is the palette's first entry
 * rather than a hex string invented in a handler.
 */
const SOLO_COLOUR = PLAYER_COLOURS[0];

/** The account or guest behind this request, creating a guest if there is none. */
export async function identify(instance: Auth, request: Request): Promise<Identified> {
  const session = await instance.api.getSession({ headers: request.headers });

  if (session !== null) {
    return { player: { userId: session.user.id, colour: SOLO_COLOUR }, setCookies: [] };
  }

  const { headers, response } = await instance.api.signInAnonymous({
    returnHeaders: true,
  });

  // The plugin can decline — it refuses to hand a second anonymous identity to a
  // browser that already has one. There is nothing to recover from here: no
  // session and no guest means no participant, and the caller decides what to
  // say.
  if (response === null) {
    throw new Error('signInAnonymous returned no guest identity');
  }

  return {
    player: { userId: response.user.id, colour: SOLO_COLOUR },
    setCookies: headers.getSetCookie(),
  };
}
