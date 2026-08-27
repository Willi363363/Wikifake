// The item catalogue and its effects.
//
// The catalogue is mechanics only: how many players an item needs, what it
// touches, for how long. Names, icons and descriptions are interface text —
// they belong to the design system of phase 6 and get translated in phase 11,
// and a rule that carries a French sentence is a rule nobody can translate.
// The identifiers themselves are the contract, and live in `protocol`.
//
// Four of the thirteen items touch server state. The other nine make the
// article hard to read for a few seconds and are the client's business
// entirely — which is a fact worth stating, because `FREEZE_TIME` was in that
// second group by accident (D7) rather than by design.
import { ITEM_IDS, type ItemId } from '@wikifake/protocol';

import { STEAL_AMOUNT } from './scoring.js';

/** C1.5 — how long `HINT_LOCK` blocks its target, in seconds. */
export const HINT_BLOCK_SECONDS = 20;
/** How much of the clock `FREEZE_TIME` eats, in seconds. */
export const FREEZE_TIME_SECONDS = 10;

/** What an item touches. `visual` means: nothing the server knows about. */
export type ItemKind = 'score' | 'hints' | 'time' | 'reveal' | 'visual';

export interface ItemDefinition {
  readonly id: ItemId;
  readonly kind: ItemKind;
  /** How many other players the caster must name. 0 means it lands on them. */
  readonly targets: 0 | 1;
}

/** One definition per identifier — exhaustively, which a test checks. */
export const ITEM_CATALOGUE: Readonly<Record<ItemId, ItemDefinition>> = {
  HINT_LOCK: { id: 'HINT_LOCK', kind: 'hints', targets: 1 },
  FREEZE_TIME: { id: 'FREEZE_TIME', kind: 'time', targets: 1 },
  SCORE_STEAL: { id: 'SCORE_STEAL', kind: 'score', targets: 1 },
  SCANNER: { id: 'SCANNER', kind: 'reveal', targets: 0 },
  EARTHQUAKE: { id: 'EARTHQUAKE', kind: 'visual', targets: 1 },
  BLACKOUT: { id: 'BLACKOUT', kind: 'visual', targets: 1 },
  BLUR: { id: 'BLUR', kind: 'visual', targets: 1 },
  RICKROLL: { id: 'RICKROLL', kind: 'visual', targets: 1 },
  MIRROR: { id: 'MIRROR', kind: 'visual', targets: 1 },
  TINY: { id: 'TINY', kind: 'visual', targets: 1 },
  SPIN: { id: 'SPIN', kind: 'visual', targets: 1 },
  CONFETTI: { id: 'CONFETTI', kind: 'visual', targets: 1 },
  INVERT: { id: 'INVERT', kind: 'visual', targets: 1 },
};

/** Every definition, in the order the contract lists the identifiers. */
export const ITEMS: readonly ItemDefinition[] = ITEM_IDS.map((id) => ITEM_CATALOGUE[id]);

/**
 * What items have done to a player, this round.
 *
 * Serialisable on purpose: phase 5 keeps room state in Redis, and a `Set` does
 * not survive `JSON.stringify`.
 */
export interface ItemState {
  /** C1.5 — points taken by `SCORE_STEAL`, subtracted at grading. */
  readonly scoreStolen: number;
  /** C1.5 — hint purchases refused until this instant. 0 means never blocked. */
  readonly hintsBlockedUntil: number;
  /** Seconds of clock eaten by `FREEZE_TIME`, added to elapsed at grading. */
  readonly timePenaltySeconds: number;
  /** C1.6 — paragraphs the SCANNER has already pointed this player at. */
  readonly scanned: readonly number[];
}

export const EMPTY_ITEM_STATE: ItemState = {
  scoreStolen: 0,
  hintsBlockedUntil: 0,
  timePenaltySeconds: 0,
  scanned: [],
};

/** C1.5 — whether hint purchases are refused right now. */
export function areHintsBlocked(state: ItemState, now: number): boolean {
  return now < state.hintsBlockedUntil;
}

/**
 * Applies an item to the player it lands on.
 *
 * `now` is a parameter: `HINT_LOCK` needs an instant, and reading a clock in
 * here would make the reducer of step 1.9 untestable.
 *
 * `SCANNER` is absent on purpose — it lands on the caster and answers with a
 * paragraph, so it is `scan` below rather than a state transition.
 *
 * A visual item returns the state it was given. That is the point of routing
 * every identifier through one exhaustive switch: an item added to the contract
 * without a decision here fails to compile.
 */
export function applyItemToTarget(id: ItemId, state: ItemState, now: number): ItemState {
  switch (id) {
    case 'SCORE_STEAL':
      return { ...state, scoreStolen: state.scoreStolen + STEAL_AMOUNT };
    case 'HINT_LOCK':
      // Extends rather than replaces: two locks in a row do not shorten the
      // block, and a stale one does not cut a fresh one short.
      return {
        ...state,
        hintsBlockedUntil: Math.max(state.hintsBlockedUntil, now + HINT_BLOCK_SECONDS),
      };
    case 'FREEZE_TIME':
      // D7 — the current server only tells the client to show a frozen clock,
      // so the item does nothing of what it announces. Here it takes the
      // seconds out of the time bonus, which is what "eats the clock" means.
      return {
        ...state,
        timePenaltySeconds: state.timePenaltySeconds + FREEZE_TIME_SECONDS,
      };
    case 'SCANNER':
      return state;
    case 'EARTHQUAKE':
    case 'BLACKOUT':
    case 'BLUR':
    case 'RICKROLL':
    case 'MIRROR':
    case 'TINY':
    case 'SPIN':
    case 'CONFETTI':
    case 'INVERT':
      return state;
  }
}

/**
 * C1.6 — the SCANNER's answer: a falsified paragraph the caster has not found.
 *
 * Resolved here, not by the client: the client does not know the solution, which
 * is the whole point of C1.1. Skips what the player has already marked — marking
 * a paragraph earns nothing by itself, so pointing at one they ticked would be
 * spending an item for nothing — and what a previous SCANNER already gave them.
 *
 * Deterministic, taking the lowest index left, where the current server draws at
 * random. The information is identical either way, and a random draw would make
 * this untestable for no gain.
 *
 * `null` once nothing is left. The current server sends no message at all, so a
 * client cannot tell exhaustion from a lost frame.
 */
export function scan(
  falsifiedIndices: readonly number[],
  state: ItemState,
  marked: readonly number[],
): { readonly state: ItemState; readonly paragraphIndex: number | null } {
  const excluded = new Set([...marked, ...state.scanned]);
  const candidates = falsifiedIndices.filter((index) => !excluded.has(index));

  if (candidates.length === 0) return { state, paragraphIndex: null };

  const chosen = Math.min(...candidates);
  return {
    state: { ...state, scanned: [...state.scanned, chosen] },
    paragraphIndex: chosen,
  };
}

export type TargetCheck =
  { readonly ok: true } | { readonly ok: false; readonly code: 'invalid_target' };

/**
 * D6 — validates the targets of a `use_item`.
 *
 * Today none of this is checked: the handler walks whatever list arrived, so a
 * player can steal 50 points from themselves — which is legal and merely silly —
 * or name the same rival eight times, which multiplies one item into eight
 * effects.
 *
 * The count has to match the catalogue exactly: a self-cast item with a target
 * is as wrong as a targeted one without.
 */
export function validateTargets(
  id: ItemId,
  caster: string,
  targets: readonly string[],
): TargetCheck {
  const expected = ITEM_CATALOGUE[id].targets;

  if (targets.length !== expected) return { ok: false, code: 'invalid_target' };
  if (targets.includes(caster)) return { ok: false, code: 'invalid_target' };
  if (new Set(targets).size !== targets.length)
    return { ok: false, code: 'invalid_target' };

  return { ok: true };
}
