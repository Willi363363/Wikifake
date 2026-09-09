// `POST /api/account/pseudonym` — step E.3.2.
//
// The one way an account acquires the name other players see. Two screens call
// it and they are the two ways an account can exist without one: sign-up, which
// has just created the account, and the screen that catches everybody else —
// every account that arrived through Google, and anybody whose sign-up claim
// lost a race.
//
// **A body rather than a query parameter**, unlike the ticket route beside it.
// A pseudonym is not what the request is *bound* to, it is what the request
// *sends*; and a name that lands in an access log because it travelled in a URL
// is a name in a file nobody meant to keep.
import { z } from 'zod';

import { playerName } from '../primitives.js';

/**
 * The name asked for, held to the schema a room would hold it to.
 *
 * `playerName` and not a looser rule of its own: an account must not be able to
 * hold a pseudonym its owner could never play a room under, which is E.3.3's
 * whole premise and is cheaper to guarantee here than to repair there.
 */
export const claimPseudonymRequest = z.object({
  pseudonym: playerName,
});
export type ClaimPseudonymRequest = z.infer<typeof claimPseudonymRequest>;

/**
 * The pseudonym as it was stored, echoed back.
 *
 * Echoed rather than assumed, because `playerName` trims: a caller that sent
 * `"  ada  "` holds `"ada"`, and a screen that went on displaying what it typed
 * would be showing a name no other player will ever see.
 */
export const claimPseudonymResponse = z.object({
  pseudonym: playerName,
});
export type ClaimPseudonymResponse = z.infer<typeof claimPseudonymResponse>;
