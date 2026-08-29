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
// Since step 11.2 the names and blurbs live in the catalogue
// (`messages/<locale>/round.json`, under `items`): this module keeps only what
// is not copy — the glyph, and the catalogue key each identifier reads.
import {
  FREEZE_TIME_SECONDS,
  HINT_BLOCK_SECONDS,
  ITEM_CATALOGUE,
  STEAL_AMOUNT,
} from '@wikifake/domain';
import type { ItemId } from '@wikifake/protocol';

/** The `items.*` entry an identifier reads its name and blurb from. */
export type ItemKey =
  | 'hintLock'
  | 'freezeTime'
  | 'scoreSteal'
  | 'scanner'
  | 'earthquake'
  | 'blackout'
  | 'blur'
  | 'rickroll'
  | 'mirror'
  | 'tiny'
  | 'spin'
  | 'confetti'
  | 'invert';

export interface ItemLabel {
  /** The catalogue key. The name and blurb are `items.<key>.name` / `.blurb`. */
  readonly key: ItemKey;
  /** A glyph. The bar is text, so nothing here is an image. */
  readonly icon: string;
}

export const ITEM_LABELS: Readonly<Record<ItemId, ItemLabel>> = {
  HINT_LOCK: { key: 'hintLock', icon: '🔒' },
  FREEZE_TIME: { key: 'freezeTime', icon: '⏸' },
  SCORE_STEAL: { key: 'scoreSteal', icon: '⚡' },
  SCANNER: { key: 'scanner', icon: '🔎' },
  EARTHQUAKE: { key: 'earthquake', icon: '🌋' },
  BLACKOUT: { key: 'blackout', icon: '⬛' },
  BLUR: { key: 'blur', icon: '👁' },
  RICKROLL: { key: 'rickroll', icon: '🤡' },
  MIRROR: { key: 'mirror', icon: '🪞' },
  TINY: { key: 'tiny', icon: '🔬' },
  SPIN: { key: 'spin', icon: '🌀' },
  CONFETTI: { key: 'confetti', icon: '🎊' },
  INVERT: { key: 'invert', icon: '🌑' },
};

/**
 * The numbers the blurbs quote, straight from the rules.
 *
 * Passed to every blurb translation: a message only reads the placeholder it
 * names, so handing all three to all of them is what lets a balance change in
 * `@wikifake/domain` reach the copy without anyone re-editing a catalogue.
 */
export const ITEM_BLURB_VALUES = {
  lockSeconds: HINT_BLOCK_SECONDS,
  freezeSeconds: FREEZE_TIME_SECONDS,
  stealPoints: STEAL_AMOUNT,
} as const;

export function labelFor(id: ItemId): ItemLabel {
  return ITEM_LABELS[id];
}

/** Whether the item lands on the caster and needs nobody named. */
export function isSelfCast(id: ItemId): boolean {
  return ITEM_CATALOGUE[id].targets === 0;
}
