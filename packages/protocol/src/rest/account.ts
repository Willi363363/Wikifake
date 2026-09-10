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

import { regionId } from '../regions.js';

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

/**
 * G.1 — `POST /api/account/region`: the region a player picks for themselves.
 *
 * The choice always wins over the derived one, so this is the only thing that
 * writes `chosen_region`. There is no request to *clear* it: reverting to the
 * inference is a feature nobody has asked for, and a player who wants a
 * different board picks it.
 */
export const chooseRegionRequest = z.object({ region: regionId });
export type ChooseRegionRequest = z.infer<typeof chooseRegionRequest>;

/** What a player is ranked in now, echoed so a screen shows the server's answer. */
export const chooseRegionResponse = z.object({ region: regionId });
export type ChooseRegionResponse = z.infer<typeof chooseRegionResponse>;

/**
 * H.6 — `POST /api/account/cosmetics`: what the player is wearing.
 *
 * **One identifier, and the slot is not sent.** A cosmetic belongs to exactly
 * one slot and `@wikifake/domain`'s catalogue says which, so a request carrying
 * both would be a request that can disagree with itself — and the server would
 * have to decide which half to believe. `wear` reads the slot from the item.
 *
 * `cosmeticId` is a string here rather than an enum of the catalogue, and that
 * is the same decision `quest_assignment.rule_id` made in the schema: the
 * catalogue is meant to grow and to retire, and a wire enum would make either
 * one a protocol version. The server refuses an identifier it does not know.
 *
 * Taking one off is `slot` with no `cosmeticId`, because that is the only shape
 * that can express it: there is no identifier for "the design system's own
 * choice" — H.5 refused a free catalogue entry, so the default is not an item.
 */
export const wearCosmeticRequest = z.union([
  z.object({ cosmeticId: z.string().min(1).max(64) }),
  z.object({ slot: z.enum(['marker', 'markStyle', 'frame']) }),
]);
export type WearCosmeticRequest = z.infer<typeof wearCosmeticRequest>;

/**
 * The whole outfit back, not the one slot that changed.
 *
 * A screen that patched its own state from a single slot would be a screen that
 * can drift from the server. Three fields, each null for the default, is the
 * same shape `outfitFrom` produces — so the answer is what the next page load
 * would have shown.
 */
export const wearCosmeticResponse = z.object({
  marker: z.string().nullable(),
  markStyle: z.string().nullable(),
  frame: z.string().nullable(),
});
export type WearCosmeticResponse = z.infer<typeof wearCosmeticResponse>;

/**
 * H.6 — `GET /api/account/cosmetics`: the outfit, and what is owned.
 *
 * No request: a `GET` has no body and the account is the session's, which is
 * `exportAccountResponse`'s reasoning. The outfit is spelled out again rather
 * than composed from `wearCosmeticResponse`, because the two are separate
 * contracts that happen to agree today — and `rest.md` is generated from these
 * shapes, so a reader sees what each answer contains.
 *
 * `owned` is the catalogue identifiers the ledger says were bought, oldest
 * first. A screen needs it to know what it may offer; the server checks it again
 * on the way in, because a list handed to a browser is a list a browser can
 * edit.
 */
export const readCosmeticsResponse = z.object({
  marker: z.string().nullable(),
  markStyle: z.string().nullable(),
  frame: z.string().nullable(),
  owned: z.array(z.string()),
});
export type ReadCosmeticsResponse = z.infer<typeof readCosmeticsResponse>;
