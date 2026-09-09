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

/**
 * `GET /api/account/export` — step E.7, and the loosest schema in the
 * catalogue on purpose.
 *
 * Every other response here is a contract: two ends agreed on a shape, and the
 * encoder drops anything the schema does not declare. An export is the
 * opposite. It is *everything this application holds about one account*, and
 * encoding it through a shape would silently drop the first column somebody
 * adds without remembering to widen the schema — which is the one failure an
 * export must not have, because nobody would ever see it.
 *
 * So the catalogue records that the route exists and answers with an object,
 * and `packages/db`'s `AccountExport` is what says what is in it.
 * `account.test.ts` holds the contents; C8.1 holds the existence.
 */
export const exportAccountResponse = z.looseObject({});
export type ExportAccountResponse = z.infer<typeof exportAccountResponse>;

/** No body: the account is the session's, and there is nothing to say. */
export const deleteAccountRequest = z.object({});
export type DeleteAccountRequest = z.infer<typeof deleteAccountRequest>;

/**
 * What a deletion came to.
 *
 * Answered rather than swallowed, because "your account is gone" is a sentence
 * a player has to take on trust and these two numbers are the evidence: the
 * rounds that survive under a name nothing links back, and the reports that
 * keep their content and lose their author.
 */
export const deleteAccountResponse = z.object({
  participants: z.int().nonnegative(),
  reports: z.int().nonnegative(),
});
export type DeleteAccountResponse = z.infer<typeof deleteAccountResponse>;
