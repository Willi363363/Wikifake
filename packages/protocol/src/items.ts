// D8 — the item identifiers, in one place.
//
// They exist twice today, synchronised by hand: `backend/src/realtime/items.py`
// decides what to hand out, `frontend/src/features/items/catalog.js` decides how
// to draw it. Adding an item meant editing both, and forgetting one meant the
// client rendering an item it had no name for — which `itemDef` handles by
// returning `{}`, so the failure is a blank card rather than an error.
//
// Here the list is the contract, both ends import it, and an unknown identifier
// stops being representable.
//
// What each item *does* is a rule, and lives in `@wikifake/domain`. What it is
// *called* is interface text: it belongs to the design system of phase 6 and
// gets translated in phase 11. Neither is here.
import { z } from 'zod';

export const ITEM_IDS = [
  /** Blocks the target's hint purchases for 20 seconds (C1.5). */
  'HINT_LOCK',
  /** Eats 10 seconds of the target's clock, and of their time bonus. */
  'FREEZE_TIME',
  /** Takes 50 points from the target (C2.1). */
  'SCORE_STEAL',
  /** Points the caster at a falsified paragraph they have not found (C1.6). */
  'SCANNER',
  // The rest are visual: they make the article hard to read for a few seconds
  // and touch no server state.
  'EARTHQUAKE',
  'BLACKOUT',
  'BLUR',
  'RICKROLL',
  'MIRROR',
  'TINY',
  'SPIN',
  'CONFETTI',
  'INVERT',
] as const;

export const itemId = z.enum(ITEM_IDS);
export type ItemId = z.infer<typeof itemId>;

/**
 * One item in a player's hand.
 *
 * `instanceId` is what a `use_item` names: a player can hold two SCANNERs, and
 * spending one must not spend both.
 */
export const itemInstance = z.object({
  instanceId: z.string().min(1),
  itemId,
});
export type ItemInstance = z.infer<typeof itemInstance>;
