/** @vitest-environment jsdom */

// C1.4 — what the client does with a hint it has paid for.
//
// The rule is one word: monotonic. The completion criterion of the step —
// "buying level 2 then requesting level 1 again displays level 2 without
// rebilling" — is that rule seen from the outside, and it is asserted twice: on
// the merge, which is where arrival order can undo it, and on the panel, which is
// where the player would see it undone.
import { act, cleanup, render } from '@testing-library/react';
import type { gameApi } from '@wikifake/protocol';
import { afterEach, describe, expect, it } from 'vitest';

import { merged, pointedAt, useHints, type Hints, type HintsState } from './hints.js';

const nudge = (number: number, hint = 'Look at the duration.'): gameApi.HintResponse => ({
  falseInfoNumber: number,
  hint,
  charged: 50,
  hintPenalty: 50,
  grant: { level: 1 },
});

const reveal = (
  number: number,
  over: Partial<{
    truth: string;
    paragraphIndex: number;
    charged: number;
    penalty: number;
  }> = {},
): gameApi.HintResponse => ({
  falseInfoNumber: number,
  hint: 'Look at the duration.',
  charged: over.charged ?? 200,
  hintPenalty: over.penalty ?? 200,
  grant: {
    level: 2,
    truth: over.truth ?? 'A cat sleeps about twelve hours, not sixteen.',
    paragraphIndex: over.paragraphIndex ?? 1,
  },
});

afterEach(() => {
  cleanup();
});

describe('8.2 — the merge', () => {
  it('records a nudge', () => {
    expect(merged({}, nudge(1))).toEqual({
      1: { level: 1, hint: 'Look at the duration.' },
    });
  });

  it('records a reveal with its truth and its position', () => {
    const held = merged({}, reveal(1, { paragraphIndex: 3 }));
    expect(held[1]?.level).toBe(2);
    expect(held[1]?.truth).toContain('twelve hours');
    expect(held[1]?.paragraphIndex).toBe(3);
  });

  it('upgrades a nudge into a reveal', () => {
    const held = merged(merged({}, nudge(1)), reveal(1));
    expect(held[1]?.level).toBe(2);
    expect(held[1]?.truth).not.toBeUndefined();
  });

  // The criterion. The server is monotonic too — a level-1 request after a
  // level-2 purchase answers level 2 — so this is about arrival order: two
  // requests in flight can land either way round, and the older answer must not
  // take the truth off the screen and put a Reveal button back on it.
  it('never goes backwards, whatever order the answers arrive in', () => {
    const held = merged(merged({}, reveal(1)), nudge(1));
    expect(held[1]?.level).toBe(2);
    expect(held[1]?.truth).not.toBeUndefined();
    expect(held[1]?.paragraphIndex).toBe(1);
  });

  it('keeps each falsification separate', () => {
    const held = merged(merged({}, nudge(1)), reveal(2));
    expect(held[1]?.level).toBe(1);
    expect(held[2]?.level).toBe(2);
  });

  it('leaves what it was given untouched', () => {
    const before: Hints = { 1: { level: 1, hint: 'a' } };
    merged(before, reveal(1));
    expect(before[1]?.level).toBe(1);
  });
});

describe('8.2 — what a hint points at', () => {
  it('points at a paragraph only once the reveal is paid for', () => {
    // A level-1 hint is a sentence, not a location. The current game highlights
    // the paragraph at level 1 as well, which hands over the answer at the
    // nudge's price.
    expect(pointedAt(merged({}, nudge(1))).size).toBe(0);
    expect([...pointedAt(merged({}, reveal(1, { paragraphIndex: 2 })))]).toEqual([2]);
  });

  it('collects every revealed paragraph', () => {
    const held = merged(
      merged({}, reveal(1, { paragraphIndex: 2 })),
      reveal(2, { paragraphIndex: 5 }),
    );
    expect([...pointedAt(held)].sort()).toEqual([2, 5]);
  });
});

describe('8.2 — the ledger of a round', () => {
  /** Mounts the hook and hands its state back, re-read on every render. */
  function mount(key: string) {
    const box: { held: HintsState | null } = { held: null };
    function Host({ round }: { round: string }) {
      box.held = useHints(round);
      return null;
    }
    const view = render(<Host round={key} />);
    const state = (): HintsState => {
      const held = box.held;
      if (held === null) throw new Error('the hook did not run');
      return held;
    };
    return {
      state,
      rerender: (next: string) => {
        view.rerender(<Host round={next} />);
      },
    };
  }

  it('starts with nothing bought and nothing owed', () => {
    const { state } = mount('round-1');
    expect(state().held).toEqual({});
    expect(state().hintsUsed).toBe(0);
    expect(state().penalty).toBe(0);
    expect(state().blocked).toBe(false);
  });

  it('counts the falsifications bought on, not the purchases', () => {
    const { state } = mount('round-1');
    act(() => {
      state().apply(nudge(1));
    });
    act(() => {
      state().apply(reveal(1, { charged: 150, penalty: 200 }));
    });

    // One target, two purchases.
    expect(state().hintsUsed).toBe(1);
  });

  // C1.3 — the penalty is the server's number. The current hook recomputes it
  // from its own copy of the scale, which is a second opinion on what is owed.
  it('takes the penalty from the server rather than adding up the charges', () => {
    const { state } = mount('round-1');
    act(() => {
      state().apply(nudge(1));
    });
    expect(state().penalty).toBe(50);

    // A payload whose running total is not the sum of what this client has seen
    // — a hint bought in another tab, a frame that was missed. The server's
    // number wins.
    act(() => {
      state().apply({ ...nudge(2), charged: 50, hintPenalty: 300 });
    });
    expect(state().penalty).toBe(300);
  });

  it('clears everything when the round changes', () => {
    const { state, rerender } = mount('round-1');
    act(() => {
      state().apply(reveal(1));
    });
    expect(state().hintsUsed).toBe(1);

    // The fix of this step: the current hook keys on `totalFakes`, so two
    // consecutive rounds with the same number of falsifications — the common
    // case — shared a ledger. It only ever worked because the round unmounted.
    rerender('round-2');
    expect(state().held).toEqual({});
    expect(state().penalty).toBe(0);
    expect(state().hintsUsed).toBe(0);
  });

  it('keeps everything when the round does not change', () => {
    const { state, rerender } = mount('round-1');
    act(() => {
      state().apply(reveal(1));
    });
    rerender('round-1');
    expect(state().hintsUsed).toBe(1);
  });

  it('remembers a jam, and forgets it when told to', () => {
    const { state } = mount('round-1');
    act(() => {
      state().block();
    });
    expect(state().blocked).toBe(true);

    act(() => {
      state().clearBlocked();
    });
    expect(state().blocked).toBe(false);
  });

  it('takes the jam off as soon as something is granted', () => {
    const { state } = mount('round-1');
    act(() => {
      state().block();
    });
    act(() => {
      state().apply(nudge(1));
    });
    expect(state().blocked).toBe(false);
  });
});
