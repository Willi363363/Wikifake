// `POST /api/shop/buy` — step H.7.
//
// The only thing that spends coins on a cosmetic, and the third place in this
// track that refuses an overdraft with a sentence rather than a constraint: H.1
// deliberately has no check against a negative balance, because an overdraft
// arriving as a database error is one nobody can explain to a player.
//
// **Buying does not wear.** A purchase that also changed how the player looks
// would be one action with two effects — and the moment H.8's refund seam is
// real, "what does undoing this undo" has two answers instead of one. The shop
// shows every owned item with a *Wear* button beside it, so nothing is hidden;
// what a player gains is that buying a second marker to keep for later does not
// change the one they are using.
import {
  purchaseCosmetic,
  selectBalance,
  selectOwnedCosmetics,
  type Database,
} from '@wikifake/db';
import { cosmeticById } from '@wikifake/domain';
import { accountApi, decode } from '@wikifake/protocol';

import type { auth } from '../auth/auth.js';
import { readJson } from '../game/body.js';
import { refuse } from '../game/errors.js';
import { json } from '../respond.js';

export interface ShopContext {
  readonly auth: ReturnType<typeof auth>;
  readonly db: Database['db'];
}

export async function handleBuyCosmetic(
  context: ShopContext,
  request: Request,
): Promise<Response> {
  const parsed = decode(accountApi.buyCosmeticRequest, await readJson(request));
  if (!parsed.ok) return refuse('bad_json', parsed.issues.join('; '));

  const session = await context.auth.api.getSession({ headers: request.headers });
  // A guest has no ledger to spend from, and E.3.2's rule is that a guest and a
  // stranger get the identical refusal: a client cannot act on the difference.
  if (session === null || session.user.isAnonymous === true) {
    return refuse('session_not_found', 'Sign up before buying anything.');
  }

  const userId = session.user.id;
  const cosmetic = cosmeticById(parsed.value.cosmeticId);
  // Unknown gets its own code here, unlike wearing — and the asymmetry is the
  // point. `cosmetic_not_owned` on the wear path hides whether a thing exists
  // from somebody who has not got it; a *shop* has a public catalogue, so
  // refusing to say what is in it would be secrecy about a price list.
  if (cosmetic === null) {
    return refuse('cosmetic_not_found', 'There is nothing like that for sale.');
  }

  const [owned, balance] = await Promise.all([
    selectOwnedCosmetics(context.db, userId),
    selectBalance(context.db, userId),
  ]);

  // Already bought: answered rather than refused, because H.6's idempotency key
  // is the cosmetic and a second attempt spends nothing. A refusal would make a
  // double-click look like a failure.
  if (owned.includes(cosmetic.id)) {
    return json(accountApi.buyCosmeticResponse, {
      cosmeticId: cosmetic.id,
      spent: 0,
      balance,
      already: true,
    });
  }

  // Checked before the write, and refused with a sentence — H.4's arrangement
  // for hints, and the reason H.1 has no constraint on the balance.
  if (balance < cosmetic.price) {
    return refuse('insufficient_coins', 'Not enough coins for that yet.');
  }

  const bought = await purchaseCosmetic(context.db, {
    userId,
    cosmeticId: cosmetic.id,
    price: cosmetic.price,
  });
  // Null is an account the foreign key would refuse, which a live session makes
  // impossible — so it is the refusal the rest of the file gives rather than a
  // sentence of its own.
  if (bought === null) {
    return refuse('session_not_found', 'Sign up before buying anything.');
  }

  // `balance_after` from the movement rather than the number read above minus
  // the price: `recordMovement` writes it under a lock, so it is the balance the
  // ledger settled on even if something else moved coins in between.
  return json(accountApi.buyCosmeticResponse, {
    cosmeticId: cosmetic.id,
    spent: bought.fresh ? cosmetic.price : 0,
    balance: bought.movement.balanceAfter,
    already: !bought.fresh,
  });
}
