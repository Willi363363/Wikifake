// C1.4, C2.2 — hints: monotonic levels, billed exactly once.
//
// The ledger is the whole trick. Rather than accumulating a penalty as purchases
// come in — which is how a double-charge happens — it records the **highest
// level reached** per falsification, and the penalty is a function of that
// record. Charging twice for the same number stops being a bug to avoid and
// becomes a state that cannot be written down.
//
// C1.3 — the penalty therefore comes from server state and never from a client.
// A `hintsUsed: 9` in a submission is not ignored here: the protocol has no
// field to put it in.
import type { FalsifiedPosition } from '@wikifake/protocol';
import type * as protocol from '@wikifake/protocol';

import { hintCostFor, type HintLevel } from './scoring.js';

/**
 * What a player has unlocked, by falsification number.
 *
 * A number absent from the ledger was never bought. Level 0 is not
 * representable, which the current `dict[int, int]` allowed and then had to
 * filter out of every sum.
 *
 * A plain object rather than a `Map`: room state is serialised to Redis in
 * phase 5, and a `Map` does not survive `JSON.stringify`.
 */
export type HintLedger = Readonly<Record<number, HintLevel>>;

export const EMPTY_LEDGER: HintLedger = {};

/**
 * C2.2 — the total cost of what has been unlocked.
 *
 * Non-cumulative: a number at level 2 costs 200, not 50 + 200. Recomputed from
 * the ledger every time rather than tracked incrementally, so there is no
 * running total to drift.
 */
export function hintPenaltyFor(ledger: HintLedger): number {
  return Object.values(ledger).reduce((total, level) => total + hintCostFor(level), 0);
}

/** One billed level, as the record of it comes back. */
export interface HintPurchase {
  readonly falseInfoNumber: number;
  readonly level: number;
}

/**
 * The ledger a sequence of purchases adds up to.
 *
 * Here rather than at the call site because "what has this player unlocked" is a
 * rule about the ledger, and a handler that folded the rows itself would be a
 * second place deciding that level 2 subsumes level 1. Highest level wins, so
 * the fold does not depend on the order the rows come back in.
 *
 * A level outside {1, 2} is dropped rather than trusted: the column is
 * constrained to those two, and a ledger is the thing the penalty is computed
 * from — silently pricing a level 3 would be worse than ignoring a row that
 * cannot exist.
 */
export function ledgerFrom(purchases: readonly HintPurchase[]): HintLedger {
  const ledger: Record<number, HintLevel> = {};

  for (const purchase of purchases) {
    if (purchase.level !== 1 && purchase.level !== 2) continue;
    const held = ledger[purchase.falseInfoNumber];
    if (held === undefined || purchase.level > held) {
      ledger[purchase.falseInfoNumber] = purchase.level;
    }
  }

  return ledger;
}

/** How many falsifications the player has bought a hint on. Display only. */
export function hintsUsedFor(ledger: HintLedger): number {
  return Object.keys(ledger).length;
}

/** What the player asks for. */
export interface HintRequest {
  readonly falseInfoNumber: number;
  readonly level: HintLevel;
}

/**
 * The payload of `hint_unlocked`, minus its `type` — taken from the protocol
 * rather than restated here. Restating it is how the two would drift, which is
 * the reason `protocol` exists.
 *
 * `charged` is what **this** purchase cost, and 0 when the level was already
 * held. The sum of `charged` over a session equals `hintPenalty`, and there is a
 * test for that.
 */
export type HintPayload = protocol.gameApi.HintResponse;

export type HintGrant =
  | { readonly ok: true; readonly ledger: HintLedger; readonly payload: HintPayload }
  /** The number does not exist in this round. REST answers 404. */
  | { readonly ok: false; readonly code: 'hint_not_found' }
  /** C1.5 — `HINT_LOCK` is in effect on the buyer. */
  | { readonly ok: false; readonly code: 'hints_blocked' };

/**
 * What stops a purchase from outside the ledger.
 *
 * `blocked` is passed in rather than computed here, because knowing it means
 * reading a clock against `hintsBlockedUntil` — `areHintsBlocked` in `items.ts`
 * does that, with the instant as a parameter.
 */
export interface HintGuard {
  readonly blocked?: boolean;
}

/**
 * C1.4 — grants a hint, monotonically, and bills the difference.
 *
 * Monotonic: asking for level 1 after paying for level 2 returns level 2. The
 * player already knows the truth; re-serving the nudge and charging for it again
 * would be charging for something they cannot un-know.
 *
 * The level-2 truth rides in `grant`, so a level-1 payload has nowhere to put
 * it — C1.4's "the text of a hint is never transmitted before payment" holds by
 * shape rather than by care.
 *
 * C1.5 — a blocked buyer is refused with `hints_blocked` and the ledger comes
 * back untouched.
 */
export function grantHint(
  solution: readonly FalsifiedPosition[],
  ledger: HintLedger,
  request: HintRequest,
  guard: HintGuard = {},
): HintGrant {
  // C1.5 — refused before anything is looked up, so a blocked player learns
  // nothing: not even whether the number they asked for exists. And the ledger
  // is returned untouched, which is the other half of that guarantee.
  if (guard.blocked === true) return { ok: false, code: 'hints_blocked' };

  const position = solution.find(
    (candidate) => candidate.falseInfoNumber === request.falseInfoNumber,
  );
  if (position === undefined) return { ok: false, code: 'hint_not_found' };

  const held = ledger[request.falseInfoNumber];
  const granted: HintLevel =
    held !== undefined && held >= request.level ? held : request.level;
  const charged = hintCostFor(granted) - (held === undefined ? 0 : hintCostFor(held));

  const next: HintLedger = { ...ledger, [request.falseInfoNumber]: granted };

  return {
    ok: true,
    ledger: next,
    payload: {
      falseInfoNumber: request.falseInfoNumber,
      hint: position.hint,
      charged,
      hintPenalty: hintPenaltyFor(next),
      grant:
        granted === 2
          ? {
              level: 2,
              truth: position.explanation,
              paragraphIndex: position.paragraphIndex,
            }
          : { level: 1 },
    },
  };
}
