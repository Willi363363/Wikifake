/** @vitest-environment jsdom */

// D6 — the hand, and what has been thrown at you.
//
// The state, without a screen. What is asserted is the bookkeeping the current
// game never had a chance to get wrong, because the chain that would have driven
// it was never connected: a hand that shrinks when the server says so, a refusal
// attributed to the item that caused it, and the difference between the two
// refusals — one means the hand is stale, the other means the throw was illegal
// and the item is still yours.
import { act, cleanup, render } from '@testing-library/react';
import { ITEM_CATALOGUE } from '@wikifake/domain';
import { ITEM_IDS } from '@wikifake/protocol';
import type { ItemInstance } from '@wikifake/protocol';
import { afterEach, describe, expect, it } from 'vitest';

import { ITEM_LABELS, isSelfCast, labelFor } from './item-labels.js';
import { useItems, type ItemsState } from './items.js';

const held = (instanceId: string, itemId: ItemInstance['itemId']): ItemInstance => ({
  instanceId,
  itemId,
});

afterEach(() => {
  cleanup();
});

/** Mounts the hook and hands its state back, re-read on every render. */
function mount(key: string) {
  const box: { held: ItemsState | null } = { held: null };
  function Host({ round }: { round: string }) {
    box.held = useItems(round);
    return null;
  }
  const view = render(<Host round={key} />);
  const state = (): ItemsState => {
    const found = box.held;
    if (found === null) throw new Error('the hook did not run');
    return found;
  };
  return {
    state,
    rerender: (next: string) => {
      view.rerender(<Host round={next} />);
    },
  };
}

describe('8.3 — the catalogue is named, all of it', () => {
  // The failure that hid the whole feature: the current catalogue is
  // synchronised with the server by hand, and `itemDef` returns `{}` for an
  // identifier it does not know — so a missing entry draws a blank card.
  it.each(ITEM_IDS)('names %s, with a glyph and a line', (id) => {
    const label = labelFor(id);
    expect(label.name.length).toBeGreaterThan(0);
    expect(label.icon.length).toBeGreaterThan(0);
    expect(label.blurb.length).toBeGreaterThan(0);
  });

  it('names nothing that is not in the contract', () => {
    expect(Object.keys(ITEM_LABELS).sort()).toEqual([...ITEM_IDS].sort());
  });

  it('agrees with the rules about which items need a target', () => {
    // The rule is `ITEM_CATALOGUE`'s. This asserts the interface reads it rather
    // than keeping a second opinion, which is what `targetCount` in
    // `frontend/src/features/items/catalog.js` is.
    for (const id of ITEM_IDS) {
      expect(isSelfCast(id)).toBe(ITEM_CATALOGUE[id].targets === 0);
    }
  });

  it('has exactly one self-cast item — the detector', () => {
    expect(ITEM_IDS.filter(isSelfCast)).toEqual(['SCANNER']);
  });
});

describe('8.3 — the hand', () => {
  it('starts empty', () => {
    const { state } = mount('round-1');
    expect(state().hand).toEqual([]);
    expect(state().pending).toBeNull();
  });

  it('grows by a wave', () => {
    const { state } = mount('round-1');
    act(() => {
      state().deal([held('a', 'SPIN')]);
    });
    act(() => {
      state().deal([held('b', 'SCANNER')]);
    });

    expect(state().hand.map((item) => item.instanceId)).toEqual(['a', 'b']);
  });

  it('does not double a wave delivered twice', () => {
    const { state } = mount('round-1');
    act(() => {
      state().deal([held('a', 'SPIN')]);
    });
    act(() => {
      state().deal([held('a', 'SPIN')]);
    });

    expect(state().hand).toHaveLength(1);
  });

  it('holds two of a kind apart', () => {
    // A player can hold two detectors, and spending one must not spend both.
    const { state } = mount('round-1');
    act(() => {
      state().deal([held('a', 'SCANNER'), held('b', 'SCANNER')]);
    });
    act(() => {
      state().sending('a');
      state().spent('SCANNER');
    });

    expect(state().hand.map((item) => item.instanceId)).toEqual(['b']);
  });

  it('marks the instance in flight, and clears it when the server answers', () => {
    const { state } = mount('round-1');
    act(() => {
      state().deal([held('a', 'SPIN')]);
    });

    act(() => {
      state().sending('a');
    });
    expect(state().pending).toBe('a');

    act(() => {
      state().spent('SPIN');
    });
    expect(state().pending).toBeNull();
    expect(state().hand).toEqual([]);
  });

  it('clears everything when the round changes', () => {
    const { state, rerender } = mount('round-1');
    act(() => {
      state().deal([held('a', 'SPIN')]);
      state().hit('BLUR', 'bob');
      state().scan(2);
    });
    expect(state().hand).toHaveLength(1);

    rerender('round-2');
    expect(state().hand).toEqual([]);
    expect(state().landed).toEqual([]);
    expect(state().scanned.size).toBe(0);
    expect(state().lastScan).toBeNull();
  });
});

describe('8.3 — a refusal, and which kind', () => {
  it('keeps the item when the throw was illegal', () => {
    // `invalid_target` is refused before the item is spent, so it is still in
    // the player's hand and can be thrown again.
    const { state } = mount('round-1');
    act(() => {
      state().deal([held('a', 'SPIN')]);
      state().sending('a');
    });
    act(() => {
      state().refuse('invalid_target', 'those targets make no sense');
    });

    expect(state().hand.map((item) => item.instanceId)).toEqual(['a']);
    expect(state().pending).toBeNull();
    expect(state().refusal).toContain('make no sense');
  });

  it('drops the item when the server says it was never held', () => {
    // `item_not_held` means the hand this client is showing is stale — already
    // spent, or never theirs. Keeping it on screen invites a second refusal.
    const { state } = mount('round-1');
    act(() => {
      state().deal([held('a', 'SPIN')]);
      state().sending('a');
    });
    act(() => {
      state().refuse('item_not_held', 'you do not hold that item');
    });

    expect(state().hand).toEqual([]);
  });

  it('is cleared on request', () => {
    const { state } = mount('round-1');
    act(() => {
      state().refuse('invalid_target', 'no');
    });
    act(() => {
      state().clearRefusal();
    });
    expect(state().refusal).toBeNull();
  });

  it('is cleared by the next throw', () => {
    const { state } = mount('round-1');
    act(() => {
      state().refuse('invalid_target', 'no');
    });
    act(() => {
      state().sending('a');
    });
    expect(state().refusal).toBeNull();
  });
});

describe('8.3 — what landed, and what the detector said', () => {
  it('keeps every hit, and who threw it', () => {
    const { state } = mount('round-1');
    act(() => {
      state().hit('BLUR', 'bob');
      state().hit('SPIN', 'cleo');
    });

    expect(state().landed.map((each) => [each.itemId, each.from])).toEqual([
      ['BLUR', 'bob'],
      ['SPIN', 'cleo'],
    ]);
  });

  it('keeps two hits of the same kind apart', () => {
    const { state } = mount('round-1');
    act(() => {
      state().hit('BLUR', 'bob');
      state().hit('BLUR', 'bob');
    });

    const [first, second] = state().landed;
    expect(state().landed).toHaveLength(2);
    expect(first?.id).not.toBe(second?.id);
  });

  it('forgets one when it is dismissed', () => {
    const { state } = mount('round-1');
    act(() => {
      state().hit('BLUR', 'bob');
    });
    const only = state().landed[0];

    act(() => {
      state().dismiss(only?.id ?? '');
    });
    expect(state().landed).toEqual([]);
  });

  it('remembers every paragraph the detector pointed at', () => {
    const { state } = mount('round-1');
    act(() => {
      state().scan(2);
    });
    act(() => {
      state().scan(5);
    });

    expect([...state().scanned].sort()).toEqual([2, 5]);
    expect(state().lastScan?.paragraphIndex).toBe(5);
  });

  it('records the answer that there is nothing left', () => {
    // C1.6 — `null` once every falsification has been pointed at. The current
    // server sends nothing at all, so the client cannot tell exhaustion from a
    // lost frame.
    const { state } = mount('round-1');
    act(() => {
      state().scan(null);
    });

    expect(state().lastScan?.paragraphIndex).toBeNull();
    expect(state().scanned.size).toBe(0);
  });

  it('takes the detector out of flight when it answers', () => {
    const { state } = mount('round-1');
    act(() => {
      state().deal([held('a', 'SCANNER')]);
      state().sending('a');
    });
    act(() => {
      state().scan(3);
    });

    expect(state().pending).toBeNull();
  });
});
