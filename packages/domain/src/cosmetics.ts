// The cosmetics catalogue — step H.5.
//
// Beside the scoring scale, the item catalogue and the quest catalogue, and for
// the same reason: a business rule that must exist in exactly one place.
//
// **Nothing here has an appearance.** A cosmetic is an identifier and a price;
// what it looks like belongs to the design system, keyed by that identifier.
// That is the argument `items.ts` and `quests.ts` both make about names — a rule
// carrying a sentence is a rule nobody can translate — and it applies twice as
// hard to a hex triplet. Every colour the interface uses passes a contrast ratio
// that `packages/ui/src/contrast.ts` asserts, and a palette entry invented in
// this package would be a colour those tests never see.
//
// **Nothing here can change a round.** That is track H's own rule — *"nothing
// bought with coins may change a player's chance of winning"* — and it is held
// mechanically rather than promised: `cosmetics.test.ts` reads the source of
// every module that decides an outcome and fails if one of them so much as
// mentions this file. A cosmetic cannot tilt a round it is structurally unable
// to reach.
//
// H.6 owns ownership and wearing one. This step owns what there is to own.

/**
 * Where a cosmetic applies, and the reason the list is closed.
 *
 * Three slots, which are the three the track names — *"a token colour, a marker
 * style, a profile frame"*. Each is a place the interface already draws
 * something, so a cosmetic replaces a choice the design system was making
 * anyway rather than adding a layer to it.
 *
 * **A slot is a presentation slot, and there is deliberately no other kind.**
 * Not "no combat slot for now": the type has no member that reaches a rule
 * input, so a cosmetic that granted an extra hint or a longer round would have
 * nowhere to declare itself. Adding one would be a visible change to this union
 * and to the test that guards it, which is the point — the constraint should
 * cost an argument, not a code review nobody had.
 */
export type CosmeticSlot = 'marker' | 'markStyle' | 'frame';

export const COSMETIC_SLOTS: readonly CosmeticSlot[] = [
  /** The colour a player is drawn in: their token in a room, their own marks. */
  'marker',
  /** How a paragraph the player has marked is drawn. */
  'markStyle',
  /** The border around a pseudonym, on a board and on a profile. */
  'frame',
];

/**
 * The identifiers, and the contract for everything downstream.
 *
 * In `domain` rather than in `protocol`, for the reason F.1 gives about quests:
 * `protocol` holds what crosses the wire, and nothing here crosses it until the
 * shop screen of H.7. The move is then a re-export rather than a rename.
 *
 * **The slot is in the name as well as in the field.** The same reason the quest
 * identifiers spell out their period: a screen keys its copy on the identifier
 * without composing a string, and a reader of a stored value knows what it is
 * without a join.
 *
 * A colour word in an identifier is not an appearance. It is the name of the
 * choice, the way `HINT_LOCK` names an item — the design system decides what
 * `MARKER_CRIMSON` is drawn as, and the interface decides what it is called.
 */
export const COSMETIC_IDS = [
  'MARKER_CRIMSON',
  'MARKER_AMBER',
  'MARKER_VIOLET',
  'MARKER_SLATE',
  'MARK_STYLE_UNDERLINE',
  'MARK_STYLE_BRACKET',
  'MARK_STYLE_CORNER',
  'FRAME_HAIRLINE',
  'FRAME_DOUBLE',
  'FRAME_NOTCHED',
] as const;

export type CosmeticId = (typeof COSMETIC_IDS)[number];

export interface Cosmetic {
  readonly id: CosmeticId;
  readonly slot: CosmeticSlot;
  /**
   * What it costs, in coins. **Always positive**, which a test holds.
   *
   * There is no free entry, and that is a rule rather than an omission: what
   * every player starts with is *the design system's own choice*, which is not
   * an item and cannot be bought, sold or lost. A price of zero in this table
   * would be a purchasable nothing — a row in `coin_movement` for a movement of
   * nothing, which H.1's check refuses anyway.
   */
  readonly price: number;
}

/**
 * The cheapest thing in the shop, and what it is calibrated against.
 *
 * A round pays two coins and a quest pays twenty to a hundred and fifty
 * (`coins.ts`, `quests.ts`). A cosmetic is meant to be **a week of the retention
 * loop**, not an afternoon: at a hundred and fifty it is roughly a week of
 * dailies claimed, or a fortnight of playing without ever opening the quest
 * screen.
 *
 * Held to the earning rules by a test rather than by this comment: the cheapest
 * cosmetic must cost more than the most a single round can pay, or the shop
 * becomes something a player grinds instead of plays.
 */
export const CHEAPEST_COSMETIC_COINS = 150;

/**
 * One definition per identifier — exhaustively, which a test checks.
 *
 * The prices are a first pass and are meant to be argued with. What they are
 * calibrated against is the earning rate above, and the spread within a slot is
 * flat on purpose: a marker that costs three times another marker says one of
 * them is better, and none of them is. **What varies is the slot**, because a
 * frame is seen by everybody who reads a leaderboard and a mark style is seen
 * by the player alone.
 */
export const COSMETIC_CATALOGUE: Readonly<Record<CosmeticId, Cosmetic>> = {
  MARKER_CRIMSON: { id: 'MARKER_CRIMSON', slot: 'marker', price: 200 },
  MARKER_AMBER: { id: 'MARKER_AMBER', slot: 'marker', price: 200 },
  MARKER_VIOLET: { id: 'MARKER_VIOLET', slot: 'marker', price: 200 },
  MARKER_SLATE: { id: 'MARKER_SLATE', slot: 'marker', price: 200 },
  MARK_STYLE_UNDERLINE: { id: 'MARK_STYLE_UNDERLINE', slot: 'markStyle', price: 150 },
  MARK_STYLE_BRACKET: { id: 'MARK_STYLE_BRACKET', slot: 'markStyle', price: 150 },
  MARK_STYLE_CORNER: { id: 'MARK_STYLE_CORNER', slot: 'markStyle', price: 150 },
  FRAME_HAIRLINE: { id: 'FRAME_HAIRLINE', slot: 'frame', price: 300 },
  FRAME_DOUBLE: { id: 'FRAME_DOUBLE', slot: 'frame', price: 300 },
  FRAME_NOTCHED: { id: 'FRAME_NOTCHED', slot: 'frame', price: 300 },
};

/**
 * Whether a string is an identifier this catalogue knows.
 *
 * It exists because the column that will hold one is `text`, for the reason
 * `quest_assignment.rule_id` is: a Postgres enum would make retiring a cosmetic
 * a migration. So a stored value can outlive its definition, and every read of
 * one has to cope — which is a rule about the catalogue and belongs here rather
 * than at each call site.
 */
export function isCosmeticId(value: string): value is CosmeticId {
  return Object.hasOwn(COSMETIC_CATALOGUE, value);
}

/**
 * The definition, or **null for an identifier that no longer has one**.
 *
 * Null rather than a throw. A player who owns a retired cosmetic is not an
 * error: the ledger row that bought it is still true, and a screen that cannot
 * draw it should draw the default instead of failing. A throw here would make a
 * retirement an outage on the profile of everybody who had bought one.
 */
export function cosmeticById(id: string): Cosmetic | null {
  return isCosmeticId(id) ? COSMETIC_CATALOGUE[id] : null;
}

/** Everything in one slot, in catalogue order — what a shop section lists. */
export function cosmeticsInSlot(slot: CosmeticSlot): readonly Cosmetic[] {
  return COSMETIC_IDS.map((id) => COSMETIC_CATALOGUE[id]).filter(
    (cosmetic) => cosmetic.slot === slot,
  );
}
