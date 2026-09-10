// `POST /api/account/cosmetics` — step H.6.
//
// The one thing that writes what a player is wearing, and the one place the two
// halves of H.6 meet: **the rules say what may be worn and the ledger says what
// is owned.**
//
// Neither is decided here. `@wikifake/domain`'s `canWear` is the rule — a live
// identifier the player owns — and `selectOwnedCosmetics` is the answer to
// *owns*, derived from `cosmetic_purchase` movements rather than from an
// ownership table. This handler asks both and writes the answer, which is the
// same arrangement `isPerfectRound` has travelled in since E.4: `@wikifake/db`
// may not import the rules, so the rule's answer arrives as an argument.
import {
  selectOwnedCosmetics,
  selectWorn,
  setWornCosmetic,
  type Database,
  type WornSlot,
} from '@wikifake/db';
import { canWear, cosmeticById, outfitFrom } from '@wikifake/domain';
import { accountApi, decode } from '@wikifake/protocol';

import type { auth } from '../auth/auth.js';
import { readJson } from '../game/body.js';
import { refuse } from '../game/errors.js';
import { json } from '../respond.js';

export interface CosmeticsContext {
  readonly auth: ReturnType<typeof auth>;
  readonly db: Database['db'];
}

export async function handleWearCosmetic(
  context: CosmeticsContext,
  request: Request,
): Promise<Response> {
  const parsed = decode(accountApi.wearCosmeticRequest, await readJson(request));
  if (!parsed.ok) return refuse('bad_json', parsed.issues.join('; '));

  const session = await context.auth.api.getSession({ headers: request.headers });
  // A guest and a stranger get the identical refusal — E.3.2's rule, and it
  // holds here for a reason of its own: a guest has no ledger to own anything
  // in, so there is nothing they could be wearing.
  if (session === null || session.user.isAnonymous === true) {
    return refuse('session_not_found', 'Sign up before choosing a cosmetic.');
  }

  const userId = session.user.id;

  // Taking one off: a slot with no identifier, which is the only shape that can
  // say it. H.5 refused a free catalogue entry, so the default is not an item
  // and there is no identifier that means it.
  if (!('cosmeticId' in parsed.value)) {
    const cleared = await setWornCosmetic(context.db, userId, parsed.value.slot, null);
    if (!cleared) return refuse('session_not_found', 'Choose a pseudonym first.');
    return answer(context, userId);
  }

  const cosmetic = cosmeticById(parsed.value.cosmeticId);
  const owned = await selectOwnedCosmetics(context.db, userId);

  /*
   * **One refusal for unknown and unowned both**, and that is deliberate.
   *
   * Telling them apart would answer *does this cosmetic exist* to somebody who
   * has not got it, which is the shape of refusal `openRound` argues about at
   * length: a distinct code for "that is real but not yours" is an enumeration
   * of the catalogue for anybody who wants one, including the ones a launch has
   * not announced yet.
   *
   * `canWear` is asked rather than reimplemented, so the rule that a retired
   * identifier cannot be *newly* worn lives in one place.
   */
  if (cosmetic === null || !canWear(owned, cosmetic.id)) {
    return refuse('cosmetic_not_owned', 'That is not yours to wear.');
  }

  // The slot comes from the catalogue and never from the request — the reason
  // the contract does not carry one. A request with both could disagree with
  // itself, and the server would have to pick a half to believe.
  const worn = await setWornCosmetic(
    context.db,
    userId,
    cosmetic.slot as WornSlot,
    cosmetic.id,
  );
  if (!worn) return refuse('session_not_found', 'Choose a pseudonym first.');

  return answer(context, userId);
}

/**
 * The whole outfit, read back from the row that was just written.
 *
 * Not the value this request sent. A screen that patched one slot from its own
 * request would be a screen that can drift; reading back means the answer is
 * what the next page load would show, including a slot somebody else's request
 * changed a moment ago.
 *
 * Through `outfitFrom`, so a stored value that has since been retired comes
 * back as the default rather than as an identifier no screen can draw.
 */
async function answer(context: CosmeticsContext, userId: string): Promise<Response> {
  const row = await selectWorn(context.db, userId);
  if (row === null) return refuse('session_not_found', 'Choose a pseudonym first.');

  return json(accountApi.wearCosmeticResponse, outfitFrom(row));
}

/**
 * `GET /api/account/cosmetics` — the outfit, and what is owned.
 *
 * A guest gets an empty answer rather than a refusal, which is the opposite of
 * the write. A guest is *allowed* to have no cosmetics: a screen asking "what
 * am I wearing" on a page a guest can reach should be told "nothing", and
 * refusing would make every such screen handle a 404 that means the same thing.
 * The write refuses because writing is a claim about an account.
 */
export async function handleReadCosmetics(
  context: CosmeticsContext,
  request: Request,
): Promise<Response> {
  const session = await context.auth.api.getSession({ headers: request.headers });
  const empty = { ...outfitFrom({}), owned: [] };

  if (session === null || session.user.isAnonymous === true) {
    return json(accountApi.readCosmeticsResponse, empty);
  }

  const [row, owned] = await Promise.all([
    selectWorn(context.db, session.user.id),
    selectOwnedCosmetics(context.db, session.user.id),
  ]);

  // No profile row is the same answer as a guest: nothing worn, nothing owned.
  // Not a refusal, because E.3.2's gate is what sends that account to choose a
  // pseudonym and this endpoint is not the place to say so.
  return json(accountApi.readCosmeticsResponse, {
    ...outfitFrom(row ?? {}),
    owned: [...owned],
  });
}
