/** @vitest-environment jsdom */

// What an item looks like when it lands, and the three things this step turns on:
// every effect triggers and fades on its message, nothing is drawn from
// `Math.random()` during render, and `prefers-reduced-motion` reaches the one
// thing a stylesheet cannot switch off.
import { act, cleanup, render } from '@testing-library/react';
import { ITEM_IDS } from '@wikifake/protocol';
import type { ItemId } from '@wikifake/protocol';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EFFECTS, useEffects, type EffectsState } from './effects.js';
import { CONFETTI, scatter, SNOW } from './effects/particles.js';
import { noiseInto } from './effects/static.js';

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

function mount(key: string) {
  const box: { held: EffectsState | null } = { held: null };
  function Host({ round }: { round: string }) {
    box.held = useEffects(round);
    return null;
  }
  const view = render(<Host round={key} />);
  const state = (): EffectsState => {
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

/** Every item that shows something, with what it shows and for how long. */
const VISIBLE = ITEM_IDS.filter((id) => EFFECTS[id] !== null);

describe('8.4 — the table', () => {
  it('decides something for every item in the contract', () => {
    // Exhaustive by type; asserted at runtime too, so an entry set to `null` by
    // accident is not the same as one that was thought about.
    for (const id of ITEM_IDS) {
      expect(EFFECTS[id] === null || EFFECTS[id] !== undefined).toBe(true);
    }
  });

  it('shows nothing for the detector, whose visual is the token it points at', () => {
    expect(EFFECTS.SCANNER).toBeNull();
  });

  it('gives every visible item an overlay, a distortion, or both', () => {
    for (const id of VISIBLE) {
      const spec = EFFECTS[id];
      expect(spec?.overlay !== undefined || spec?.distortion !== undefined).toBe(true);
    }
  });

  it('bounds every effect but the pop-up, which waits to be dismissed', () => {
    for (const id of VISIBLE) {
      const lasts = EFFECTS[id]?.lasts;
      if (id === 'RICKROLL') expect(lasts).toBeNull();
      else expect(lasts).toBeGreaterThan(0);
    }
  });

  it('distorts the article for the items that claim to, and covers it for the rest', () => {
    // BLUR does both on purpose: a fog over the page, and the card blurred under
    // it. The current game does the same, and it is the only one that does.
    expect(EFFECTS.BLUR?.overlay).toBe('fog');
    expect(EFFECTS.BLUR?.distortion).toBe('blur');
    expect(EFFECTS.MIRROR?.overlay).toBeUndefined();
    expect(EFFECTS.CONFETTI?.distortion).toBeUndefined();
  });
});

describe('8.4 — triggering and fading', () => {
  // The done-when, once per item.
  it.each(VISIBLE)('shows %s on its message and takes it away again', (id: ItemId) => {
    const spec = EFFECTS[id];
    const { state } = mount('round-1');

    act(() => {
      state().cast(id);
    });
    if (spec?.overlay !== undefined)
      expect(state().overlays.has(spec.overlay)).toBe(true);
    if (spec?.distortion !== undefined) {
      expect(state().distortions.has(spec.distortion)).toBe(true);
    }

    if (spec?.lasts === null) {
      // The pop-up stays. That is its whole point.
      act(() => {
        vi.advanceTimersByTime(60_000);
      });
      expect(state().overlays.size).toBe(1);
      return;
    }

    act(() => {
      vi.advanceTimersByTime((spec?.lasts ?? 0) + 100);
    });
    expect(state().overlays.size).toBe(0);
    expect(state().distortions.size).toBe(0);
  });

  it('does not let the first cast end the second', () => {
    // Two of the same item land often — a room of four with a wave each — and a
    // flag rather than a count means the first expiry switches off an effect
    // that is still meant to be running.
    const { state } = mount('round-1');
    act(() => {
      state().cast('SPIN');
    });
    act(() => {
      vi.advanceTimersByTime(3000);
      state().cast('SPIN');
    });

    act(() => {
      vi.advanceTimersByTime(1100);
    });
    expect(state().distortions.has('spin')).toBe(true);

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(state().distortions.has('spin')).toBe(false);
  });

  it('runs two different effects at once', () => {
    const { state } = mount('round-1');
    act(() => {
      state().cast('SPIN');
      state().cast('BLUR');
    });

    expect([...state().distortions].sort()).toEqual(['blur', 'spin']);
    expect([...state().overlays]).toEqual(['fog']);
  });

  it('lets the pop-up be dismissed', () => {
    const { state } = mount('round-1');
    act(() => {
      state().cast('RICKROLL');
    });
    act(() => {
      state().dismiss('rickroll');
    });
    expect(state().overlays.size).toBe(0);
  });

  it('dismisses every cast of it at once', () => {
    // One close button, and a second pop-up behind the first is a pop-up that
    // will not go away.
    const { state } = mount('round-1');
    act(() => {
      state().cast('RICKROLL');
      state().cast('RICKROLL');
    });
    act(() => {
      state().dismiss('rickroll');
    });
    expect(state().overlays.size).toBe(0);
  });

  it('clears everything when the round changes', () => {
    const { state, rerender } = mount('round-1');
    act(() => {
      state().cast('SPIN');
      state().cast('RICKROLL');
    });

    // An effect outliving its round is an article shaking under a lobby.
    rerender('round-2');
    expect(state().overlays.size).toBe(0);
    expect(state().distortions.size).toBe(0);
  });

  it('leaves no timer behind when it is unmounted', () => {
    const { state } = mount('round-1');
    act(() => {
      state().cast('HINT_LOCK');
    });
    expect(vi.getTimerCount()).toBeGreaterThan(0);

    cleanup();
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('8.4 — the particles', () => {
  /** A sequence rather than a source of randomness, so this can be asserted. */
  const counting = () => {
    let at = 0;
    return () => {
      at += 1;
      return (at % 100) / 100;
    };
  };

  it('scatters the number the current game scatters', () => {
    expect(scatter(SNOW, counting())).toHaveLength(120);
    expect(scatter(CONFETTI, counting())).toHaveLength(80);
  });

  it('keeps every piece inside the viewport, and moving', () => {
    for (const piece of scatter(SNOW, Math.random)) {
      expect(piece.left).toBeGreaterThanOrEqual(0);
      expect(piece.left).toBeLessThanOrEqual(100);
      expect(piece.duration).toBeGreaterThan(0);
      expect(piece.size).toBeGreaterThanOrEqual(SNOW.minSize);
      expect(piece.size).toBeLessThanOrEqual(SNOW.maxSize);
    }
  });

  it('starts every piece part-way through its fall', () => {
    // A negative delay: the snow is already falling when the sheet appears,
    // rather than every flake starting from the top edge together.
    for (const piece of scatter(SNOW, Math.random)) {
      expect(piece.delay).toBeLessThanOrEqual(0);
    }
  });

  it('takes its randomness from where it is told', () => {
    // Which is what makes it possible to generate them after mount rather than
    // during render — the fix this step names.
    const one = scatter(CONFETTI, counting());
    const two = scatter(CONFETTI, counting());
    expect(one).toEqual(two);
  });
});

describe('8.4 — the static, without a canvas', () => {
  it('fills every pixel it is given', () => {
    const data = new Uint8ClampedArray(4 * 64);
    noiseInto(data, Math.random);

    // Alpha is the tell: every pixel gets one, so none is left transparent by a
    // branch that forgot to write.
    for (let at = 3; at < data.length; at += 4) {
      expect(data[at]).toBeGreaterThan(0);
    }
  });

  it('is mostly black, which is what makes it read as a dead signal', () => {
    const data = new Uint8ClampedArray(4 * 4000);
    noiseInto(data, Math.random);

    let black = 0;
    for (let at = 0; at < data.length; at += 4) {
      if (data[at] === 0 && data[at + 1] === 0 && data[at + 2] === 0) black += 1;
    }
    expect(black / (data.length / 4)).toBeGreaterThan(0.3);
  });

  it('draws the same frame twice from the same randomness', () => {
    const fixed = () => 0.9;
    const one = new Uint8ClampedArray(4 * 16);
    const two = new Uint8ClampedArray(4 * 16);
    noiseInto(one, fixed);
    noiseInto(two, fixed);
    expect([...one]).toEqual([...two]);
  });
});
