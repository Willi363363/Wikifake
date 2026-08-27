// What an item is called, and what it looks like.
//
// The identifiers are the contract (`packages/protocol`) and what an item *does*
// is a rule (`packages/domain`). Neither carries a name, deliberately: a rule
// with a French sentence in it is a rule nobody can translate. This is the third
// piece — interface text — and it is here because it is text of ours.
//
// Exhaustive over `ItemId` by type, which is the fix for the failure that hid
// the whole feature: the current catalogue lives in
// `frontend/src/features/items/catalog.js`, synchronised with the server by
// hand, and `itemDef` returns `{}` for an identifier it does not know. So a
// missing entry drew a blank card instead of failing.
//
// English, like the rest of the interface from the rewrite onwards. Step 8.10
// finishes that job and phase 11 translates it.
import { ITEM_CATALOGUE } from '@wikifake/domain';
import type { ItemId } from '@wikifake/protocol';

export interface ItemLabel {
  readonly name: string;
  /** A glyph. The bar is text, so nothing here is an image. */
  readonly icon: string;
  /** One line, in the imperative: what it does to whoever it lands on. */
  readonly blurb: string;
}

export const ITEM_LABELS: Readonly<Record<ItemId, ItemLabel>> = {
  HINT_LOCK: {
    name: 'Jammer',
    icon: '🔒',
    blurb: 'Blocks their hints for 20 seconds',
  },
  FREEZE_TIME: {
    name: 'Time sink',
    icon: '⏸',
    blurb: 'Eats 10 seconds of their clock',
  },
  SCORE_STEAL: { name: 'Pickpocket', icon: '⚡', blurb: 'Takes 50 points from them' },
  SCANNER: {
    name: 'Detector',
    icon: '🔎',
    blurb: 'Points you at a falsified paragraph you have not found',
  },
  EARTHQUAKE: { name: 'Earthquake', icon: '🌋', blurb: 'Shakes their screen' },
  BLACKOUT: { name: 'Redaction', icon: '⬛', blurb: 'Blacks out their text' },
  BLUR: { name: 'Fog', icon: '👁', blurb: 'Blurs their screen' },
  RICKROLL: { name: 'Pop-up', icon: '🤡', blurb: 'Drops a pop-up on them' },
  MIRROR: { name: 'Mirror', icon: '🪞', blurb: 'Flips their article' },
  TINY: { name: 'Broken lens', icon: '🔬', blurb: 'Shrinks their text' },
  SPIN: { name: 'Vertigo', icon: '🌀', blurb: 'Spins their article' },
  CONFETTI: { name: 'Party', icon: '🎊', blurb: 'Buries them in confetti' },
  INVERT: { name: 'Negative', icon: '🌑', blurb: 'Inverts their colours' },
};

export function labelFor(id: ItemId): ItemLabel {
  return ITEM_LABELS[id];
}

/** Whether the item lands on the caster and needs nobody named. */
export function isSelfCast(id: ItemId): boolean {
  return ITEM_CATALOGUE[id].targets === 0;
}
