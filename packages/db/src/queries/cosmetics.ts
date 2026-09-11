// Owning a cosmetic, and wearing one — step H.6.
//
// **Ownership is derived from the ledger.** Owning a cosmetic is having a
// `cosmetic_purchase` movement for it, and there is no `cosmetic_ownership`
// table. That is H.1's own argument applied a second time: a balance is the sum
// of its movements and never a column somebody can write, and *what somebody
// owns* is the same kind of fact. A second table would be a second place that
// can disagree, and reconciling the two is work nobody schedules until the day
// it is urgent.
//
// What it buys is the question a player actually asks — *why do I own this* —
// answered from the same rows as *where did my coins go*. `coin_movement_owned_idx`
// is what makes it affordable.
//
// A grant with no payment is still expressible, and is two rows rather than a
// special case: an `adjustment` crediting the price and the `cosmetic_purchase`
// spending it. The balance is unchanged, the ledger explains itself, and track
// I's admin panel needs no new mechanism.
//
// No rule is decided here. `@wikifake/domain` owns the catalogue and the wearing
// rules; this file reads and writes what those rules produced — data does not
// depend on rules, so the price and the slot arrive as arguments.
import { and, asc, eq, sql } from 'drizzle-orm';

import type { Database } from '../client.js';
import { coinMovement } from '../schema/coins.js';
import { profile } from '../schema/profile.js';
import { recordMovement, type MovementOutcome } from './coins.js';

type Tx = Parameters<Parameters<Database['db']['transaction']>[0]>[0];
type Db = Database['db'] | Tx;

/** The clause that says "this row is a cosmetic purchase by this player". */
function ownedBy(userId: string) {
  return and(
    eq(coinMovement.userId, userId),
    eq(coinMovement.source, 'cosmetic_purchase'),
  );
}

/**
 * Every cosmetic this player has bought, oldest first.
 *
 * `reference` is the identifier — the same column a quest reward puts a rule id
 * in, which is why the source is part of every clause here rather than an
 * afterthought. A null reference cannot happen on this source and is dropped
 * rather than trusted: the column is nullable because an `adjustment` may have
 * nothing but a reason.
 */
export async function selectOwnedCosmetics(
  db: Db,
  userId: string,
): Promise<readonly string[]> {
  const rows = await db
    .select({ reference: coinMovement.reference })
    .from(coinMovement)
    .where(ownedBy(userId))
    .orderBy(asc(coinMovement.seq));

  return rows
    .map((row) => row.reference)
    .filter((reference): reference is string => reference !== null);
}

/**
 * Whether this player owns this one — the read a purchase and a wear both make.
 *
 * A count and not a fetch of the list, because that is the question: a player
 * with fifty cosmetics should not have fifty rows read to answer *do you own
 * this one*. It is an index-only lookup on `coin_movement_owned_idx`, which
 * `cosmetics.test.ts` asserts against `EXPLAIN` rather than assuming.
 */
export async function ownsCosmetic(
  db: Db,
  userId: string,
  cosmeticId: string,
): Promise<boolean> {
  const rows = await db
    .select({ one: sql<number>`1` })
    .from(coinMovement)
    .where(and(ownedBy(userId), eq(coinMovement.reference, cosmeticId)))
    .limit(1);

  return rows.length > 0;
}

export interface CosmeticPurchase {
  readonly userId: string;
  readonly cosmeticId: string;
  /** From `@wikifake/domain`'s catalogue. Positive, which the catalogue holds. */
  readonly price: number;
}

/** What a purchase came to. `fresh` is false when it had already been bought. */
export interface PurchaseOutcome {
  readonly movement: MovementOutcome['movement'];
  readonly fresh: boolean;
}

/**
 * Buys a cosmetic, exactly once — step H.6.
 *
 * **The idempotency key is the cosmetic**, which is what makes owning it
 * something the ledger cannot record twice. `cosmetic:<id>` per player, so two
 * players buying the same frame do not collide and one player double-clicking
 * pays once. That is the same unique index H.1 built, doing the job a
 * `unique(user_id, cosmetic_id)` would have done on the table this step chose
 * not to create.
 *
 * No balance check here, deliberately: refusing is a sentence a player can act
 * on, and the handler is where a sentence can be said. That is the arrangement
 * H.4 settled on for hints, for the same reason H.1 has no constraint against a
 * negative balance.
 *
 * Runs in the caller's transaction when given one, so a shop that also wears
 * what it just bought does both or neither.
 */
export async function purchaseCosmetic(
  db: Db,
  purchase: CosmeticPurchase,
): Promise<PurchaseOutcome | null> {
  const outcome = await recordMovement(db, {
    userId: purchase.userId,
    amount: -purchase.price,
    source: 'cosmetic_purchase',
    reference: purchase.cosmeticId,
    idempotencyKey: `cosmetic:${purchase.cosmeticId}`,
  });

  return outcome === null ? null : { movement: outcome.movement, fresh: outcome.fresh };
}

/** The three stored strings. `@wikifake/domain`'s `outfitFrom` reads them. */
export interface WornCosmetics {
  readonly marker: string | null;
  readonly markStyle: string | null;
  readonly frame: string | null;
}

/**
 * What this player is wearing, or null when they have no profile row.
 *
 * Null and not an empty outfit, because the two are different: no row means no
 * account has chosen a pseudonym here, which E.3.2's gate handles, and a caller
 * that turned that into "wearing nothing" would draw a profile for somebody who
 * has not got one.
 */
export async function selectWorn(db: Db, userId: string): Promise<WornCosmetics | null> {
  const [row] = await db
    .select({
      marker: profile.wornMarker,
      markStyle: profile.wornMarkStyle,
      frame: profile.wornFrame,
    })
    .from(profile)
    .where(eq(profile.userId, userId));

  return row ?? null;
}

/** Which column a slot is stored in. The one place that knows. */
const COLUMN = {
  marker: 'wornMarker',
  markStyle: 'wornMarkStyle',
  frame: 'wornFrame',
} as const;

export type WornSlot = keyof typeof COLUMN;

/**
 * Writes what the player is wearing in one slot.
 *
 * **The slot arrives already decided, and the value already checked.** Working
 * out which slot a cosmetic belongs in is `@wikifake/domain`'s `wear`, and
 * whether the player may wear it is its `canWear` — this package may not import
 * either, because data does not depend on rules. So the handler asks the rules
 * and this writes the answer, which is the same shape `isPerfectRound` travels
 * in since E.4.
 *
 * `null` clears the slot back to the design system's own choice.
 *
 * An update and not an upsert, for `setChosenRegion`'s reason: a player with no
 * `profile` row has not chosen a pseudonym, and creating one here would create
 * the very row E.3.2's gate exists to prevent. `false` when nothing was touched.
 */
export async function setWornCosmetic(
  db: Db,
  userId: string,
  slot: WornSlot,
  cosmeticId: string | null,
): Promise<boolean> {
  const updated = await db
    .update(profile)
    .set({ [COLUMN[slot]]: cosmeticId, updatedAt: new Date() })
    .where(eq(profile.userId, userId))
    .returning({ userId: profile.userId });

  return updated.length > 0;
}
