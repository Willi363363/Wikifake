// What the shop screen shows — step H.7.
//
// The layer that may hold every half: `@wikifake/domain` has the catalogue,
// `@wikifake/db` has the ledger and the worn columns, and `@wikifake/ui` has the
// appearances — none of the three may import another. This is where a cosmetic
// becomes a row a screen can draw.
//
// **One read per fact, and no fact twice.** The balance, what is owned and what
// is worn are three questions of the same database, asked together because the
// screen needs all three to decide what each row's button says.
import { selectBalance, selectOwnedCosmetics, selectWorn } from '@wikifake/db';
import {
  cosmeticsInSlot,
  outfitFrom,
  COSMETIC_SLOTS,
  type CosmeticId,
  type CosmeticSlot,
  type Outfit,
} from '@wikifake/domain';
import type { Database } from '@wikifake/db';

export interface ShopContext {
  readonly db: Database['db'];
}

/**
 * One thing for sale, and where the viewer stands with it.
 *
 * `owned` and `worn` rather than one `state` enum, because they are independent:
 * a player owns four markers and wears one, and a row that collapsed the two
 * would have to invent a name for *owned, not worn, and unaffordable*.
 */
export interface StockItem {
  /**
   * The catalogue's own type, not a string — which is what lets the screen key
   * its copy on `names.${id}` and have `tsc` check that every identifier has a
   * name in both locales. A `string` here would make a missing translation a
   * runtime hole, and `catalogue.check.ts` exists so that it is not one.
   */
  readonly id: CosmeticId;
  readonly slot: CosmeticSlot;
  readonly price: number;
  readonly owned: boolean;
  readonly worn: boolean;
  /** False only when it is neither owned nor affordable. */
  readonly affordable: boolean;
}

export interface ShopView {
  readonly balance: number;
  readonly outfit: Outfit;
  /** In catalogue order, grouped by slot in `COSMETIC_SLOTS` order. */
  readonly items: readonly StockItem[];
}

/**
 * The shop, ready to render.
 *
 * The catalogue is the stock: there is no table of what is for sale, and no
 * `available` flag. Retiring a cosmetic is deleting it from the catalogue —
 * after which nobody can buy it, everybody who owns it still owns it (the
 * ledger row is still true), and `outfitFrom` reads a worn one as the default.
 * That is three behaviours from one deletion, and none of them is a migration.
 */
export async function readShop(context: ShopContext, userId: string): Promise<ShopView> {
  const [balance, owned, worn] = await Promise.all([
    selectBalance(context.db, userId),
    selectOwnedCosmetics(context.db, userId),
    selectWorn(context.db, userId),
  ]);

  const has = new Set(owned);
  const outfit = outfitFrom(worn ?? {});

  const items = COSMETIC_SLOTS.flatMap((slot) =>
    cosmeticsInSlot(slot).map((cosmetic) => ({
      id: cosmetic.id,
      slot,
      price: cosmetic.price,
      owned: has.has(cosmetic.id),
      worn: outfit[slot] === cosmetic.id,
      // Owned counts as affordable: the row's button then says *Wear*, and
      // "you cannot afford something you already have" is a sentence no screen
      // should ever be able to produce.
      affordable: has.has(cosmetic.id) || balance >= cosmetic.price,
    })),
  );

  return { balance, outfit, items };
}
