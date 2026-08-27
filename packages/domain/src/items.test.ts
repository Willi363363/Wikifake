import { describe, expect, it } from 'vitest';
import { ITEM_IDS, type ItemId } from '@wikifake/protocol';

import { grantHint } from './hints.js';
import {
  applyItemToTarget,
  areHintsBlocked,
  EMPTY_ITEM_STATE,
  FREEZE_TIME_SECONDS,
  HINT_BLOCK_SECONDS,
  ITEM_CATALOGUE,
  ITEMS,
  scan,
  validateTargets,
  type ItemState,
} from './items.js';
import { STEAL_AMOUNT, timeBonusFor } from './scoring.js';

const SOLUTION = [
  {
    paragraphIndex: 2,
    falseInfoNumber: 1,
    falseStatement: 'faux 1',
    explanation: 'vrai 1',
    hint: 'indice 1',
  },
  {
    paragraphIndex: 5,
    falseInfoNumber: 2,
    falseStatement: 'faux 2',
    explanation: 'vrai 2',
    hint: 'indice 2',
  },
  {
    paragraphIndex: 9,
    falseInfoNumber: 3,
    falseStatement: 'faux 3',
    explanation: 'vrai 3',
    hint: 'indice 3',
  },
];
const FALSIFIED = SOLUTION.map((position) => position.paragraphIndex);

describe('D8 — the catalogue covers the contract exactly', () => {
  it('defines every identifier and invents none', () => {
    expect(Object.keys(ITEM_CATALOGUE).sort()).toEqual([...ITEM_IDS].sort());
  });

  it('keys every definition by its own id', () => {
    for (const [key, definition] of Object.entries(ITEM_CATALOGUE)) {
      expect(definition.id).toBe(key);
    }
  });

  it('lists thirteen items, four of which touch server state', () => {
    expect(ITEMS).toHaveLength(13);
    expect(ITEMS.filter((item) => item.kind !== 'visual').map((item) => item.id)).toEqual(
      ['HINT_LOCK', 'FREEZE_TIME', 'SCORE_STEAL', 'SCANNER'],
    );
  });

  it('needs a target for everything except the SCANNER', () => {
    for (const item of ITEMS) {
      expect(item.targets, item.id).toBe(item.id === 'SCANNER' ? 0 : 1);
    }
  });
});

describe('C1.5 — SCORE_STEAL', () => {
  it('takes 50 points from its target', () => {
    const after = applyItemToTarget('SCORE_STEAL', EMPTY_ITEM_STATE, 0);
    expect(after.scoreStolen).toBe(STEAL_AMOUNT);
  });

  it('stacks', () => {
    let state = EMPTY_ITEM_STATE;
    state = applyItemToTarget('SCORE_STEAL', state, 0);
    state = applyItemToTarget('SCORE_STEAL', state, 0);
    expect(state.scoreStolen).toBe(2 * STEAL_AMOUNT);
  });
});

describe('C1.5 — HINT_LOCK', () => {
  it('blocks hints for twenty seconds', () => {
    const state = applyItemToTarget('HINT_LOCK', EMPTY_ITEM_STATE, 1_000);
    expect(state.hintsBlockedUntil).toBe(1_000 + HINT_BLOCK_SECONDS);
    expect(areHintsBlocked(state, 1_010)).toBe(true);
    expect(areHintsBlocked(state, 1_020)).toBe(false);
  });

  it('is not blocking by default', () => {
    expect(areHintsBlocked(EMPTY_ITEM_STATE, 0)).toBe(false);
  });

  // A stale lock must not cut a fresh one short, and two in a row must not
  // shorten the block.
  it('extends rather than replaces', () => {
    let state = applyItemToTarget('HINT_LOCK', EMPTY_ITEM_STATE, 1_000);
    state = applyItemToTarget('HINT_LOCK', state, 1_005);
    expect(state.hintsBlockedUntil).toBe(1_025);

    const late = applyItemToTarget('HINT_LOCK', state, 900);
    expect(late.hintsBlockedUntil).toBe(1_025);
  });

  // C1.5 in full: refused with the code, and the ledger stays empty.
  it('refuses the purchase and leaves the ledger empty', () => {
    const state = applyItemToTarget('HINT_LOCK', EMPTY_ITEM_STATE, 0);
    const grant = grantHint(
      SOLUTION,
      {},
      { falseInfoNumber: 1, level: 2 },
      {
        blocked: areHintsBlocked(state, 5),
      },
    );
    expect(grant).toEqual({ ok: false, code: 'hints_blocked' });
  });

  it('refuses before looking the number up, so a blocked buyer learns nothing', () => {
    const grant = grantHint(
      SOLUTION,
      {},
      { falseInfoNumber: 99, level: 1 },
      { blocked: true },
    );
    expect(grant).toEqual({ ok: false, code: 'hints_blocked' });
  });

  it('lets the purchase through once the block has passed', () => {
    const state = applyItemToTarget('HINT_LOCK', EMPTY_ITEM_STATE, 0);
    const grant = grantHint(
      SOLUTION,
      {},
      { falseInfoNumber: 1, level: 1 },
      {
        blocked: areHintsBlocked(state, HINT_BLOCK_SECONDS + 1),
      },
    );
    expect(grant.ok).toBe(true);
  });
});

describe('D7 — FREEZE_TIME actually eats the clock', () => {
  it('records the seconds it took', () => {
    const state = applyItemToTarget('FREEZE_TIME', EMPTY_ITEM_STATE, 0);
    expect(state.timePenaltySeconds).toBe(FREEZE_TIME_SECONDS);
  });

  // The current server only tells the client to draw a frozen clock, so the
  // item does nothing of what it announces. Ten seconds at half a point each
  // is five points.
  it('costs the target five points of time bonus', () => {
    const state = applyItemToTarget('FREEZE_TIME', EMPTY_ITEM_STATE, 0);
    const clean = timeBonusFor(300, 100);
    const frozen = timeBonusFor(300, 100 + state.timePenaltySeconds);
    expect(clean - frozen).toBe(5);
  });

  it('stacks', () => {
    let state = EMPTY_ITEM_STATE;
    state = applyItemToTarget('FREEZE_TIME', state, 0);
    state = applyItemToTarget('FREEZE_TIME', state, 0);
    expect(state.timePenaltySeconds).toBe(2 * FREEZE_TIME_SECONDS);
  });

  it('cannot push the bonus below zero', () => {
    expect(timeBonusFor(300, 299 + 10 * FREEZE_TIME_SECONDS)).toBe(0);
  });
});

describe('the nine visual items touch no server state', () => {
  const visual = ITEMS.filter((item) => item.kind === 'visual').map((item) => item.id);

  it('there are nine of them', () => {
    expect(visual).toHaveLength(9);
  });

  it.each(visual)('%s leaves the state alone', (id) => {
    const busy: ItemState = {
      scoreStolen: 50,
      hintsBlockedUntil: 900,
      timePenaltySeconds: 10,
      scanned: [2],
    };
    expect(applyItemToTarget(id, busy, 1_000)).toEqual(busy);
  });
});

describe('C1.6 — the SCANNER', () => {
  it('points at a falsified paragraph', () => {
    const { paragraphIndex } = scan(FALSIFIED, EMPTY_ITEM_STATE, []);
    expect(FALSIFIED).toContain(paragraphIndex);
  });

  it('remembers what it already gave this player', () => {
    let state = EMPTY_ITEM_STATE;
    const seen: (number | null)[] = [];
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const result = scan(FALSIFIED, state, []);
      state = result.state;
      seen.push(result.paragraphIndex);
    }
    expect(seen).toEqual([2, 5, 9]);
    expect(state.scanned).toEqual([2, 5, 9]);
  });

  it('returns null once every fake has been pointed at', () => {
    let state = EMPTY_ITEM_STATE;
    for (let attempt = 0; attempt < 3; attempt += 1)
      state = scan(FALSIFIED, state, []).state;
    expect(scan(FALSIFIED, state, [])).toEqual({ state, paragraphIndex: null });
  });

  // Marking a paragraph earns nothing by itself, so pointing at one the player
  // already ticked would be spending an item for nothing.
  it('skips what the player already marked', () => {
    expect(scan(FALSIFIED, EMPTY_ITEM_STATE, [2]).paragraphIndex).toBe(5);
    expect(scan(FALSIFIED, EMPTY_ITEM_STATE, [2, 5]).paragraphIndex).toBe(9);
  });

  it('returns null when the player has already marked every fake', () => {
    expect(scan(FALSIFIED, EMPTY_ITEM_STATE, FALSIFIED).paragraphIndex).toBe(null);
  });

  it('does not remember a paragraph it did not give', () => {
    const { state } = scan(FALSIFIED, EMPTY_ITEM_STATE, FALSIFIED);
    expect(state.scanned).toEqual([]);
  });

  it('leaves the state it was given alone', () => {
    scan(FALSIFIED, EMPTY_ITEM_STATE, []);
    expect(EMPTY_ITEM_STATE.scanned).toEqual([]);
  });
});

describe('D6 — targets are validated', () => {
  it('accepts one rival for a targeted item', () => {
    expect(validateTargets('BLUR', 'ada', ['bob'])).toEqual({ ok: true });
  });

  it('accepts no target for the SCANNER', () => {
    expect(validateTargets('SCANNER', 'ada', [])).toEqual({ ok: true });
  });

  // Legal today, and merely silly — but the same missing check is what lets one
  // item become eight effects.
  it('refuses the caster targeting themselves', () => {
    expect(validateTargets('SCORE_STEAL', 'ada', ['ada'])).toEqual({
      ok: false,
      code: 'invalid_target',
    });
  });

  it('refuses more targets than the item takes', () => {
    expect(validateTargets('SCORE_STEAL', 'ada', ['bob', 'cyd'])).toEqual({
      ok: false,
      code: 'invalid_target',
    });
  });

  it('refuses the same rival named twice', () => {
    expect(validateTargets('BLUR', 'ada', ['bob', 'bob'])).toEqual({
      ok: false,
      code: 'invalid_target',
    });
  });

  it('refuses a targeted item with no target', () => {
    expect(validateTargets('BLUR', 'ada', [])).toEqual({
      ok: false,
      code: 'invalid_target',
    });
  });

  it('refuses a target on a self-cast item', () => {
    expect(validateTargets('SCANNER', 'ada', ['bob'])).toEqual({
      ok: false,
      code: 'invalid_target',
    });
  });

  it.each(ITEM_IDS)('has a rule for %s', (id: ItemId) => {
    const targets = ITEM_CATALOGUE[id].targets === 0 ? [] : ['bob'];
    expect(validateTargets(id, 'ada', targets)).toEqual({ ok: true });
  });
});
