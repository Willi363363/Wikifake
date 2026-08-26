/** @vitest-environment jsdom */

// C5.5 — the other players' pointers, and the two leaks this step closes:
// a departed player's cursor that never goes away, and `window` read at render.
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { fractionOf, THROTTLE_MS, useCursors, type CursorsState } from './cursors.js';
import { PlayerCursors, type CursorView } from './player-cursors.js';

afterEach(() => {
  vi.restoreAllMocks();
  cleanup();
});

function mount(key: string, present: readonly string[]) {
  const box: { held: CursorsState | null } = { held: null };
  function Host({ round, roster }: { round: string; roster: readonly string[] }) {
    box.held = useCursors(round, roster);
    return null;
  }
  const view = render(<Host round={key} roster={present} />);
  const state = (): CursorsState => {
    const found = box.held;
    if (found === null) throw new Error('the hook did not run');
    return found;
  };
  return {
    state,
    rerender: (round: string, roster: readonly string[]) => {
      view.rerender(<Host round={round} roster={roster} />);
    },
  };
}

describe('8.5 — a position, as a fraction', () => {
  it('divides by the box it was given', () => {
    expect(fractionOf(400, 300, 800, 600)).toEqual({ x: 0.5, y: 0.5 });
  });

  it('clamps a pointer outside the box', () => {
    // A negative fraction is a cursor drawn off the left edge of everybody
    // else's screen, and the round trip is not the place to find that out.
    expect(fractionOf(-20, 900, 800, 600)).toEqual({ x: 0, y: 1 });
  });

  it('survives a box of no size', () => {
    // Which is what `window.innerWidth` is before the first layout, and what a
    // division by it would make of every position.
    expect(fractionOf(100, 100, 0, 0)).toEqual({ x: 0, y: 0 });
  });
});

describe('8.5 — whose cursors are on screen', () => {
  it('starts with nobody', () => {
    const { state } = mount('round-1', ['bob']);
    expect(state().cursors).toEqual({});
  });

  it('remembers where each player pointed', () => {
    const { state } = mount('round-1', ['bob', 'cleo']);
    act(() => {
      state().moved('bob', 0.25, 0.5);
      state().moved('cleo', 0.75, 0.1);
    });

    expect(state().cursors).toEqual({
      bob: { x: 0.25, y: 0.5 },
      cleo: { x: 0.75, y: 0.1 },
    });
  });

  it('replaces a position rather than accumulating one', () => {
    const { state } = mount('round-1', ['bob']);
    act(() => {
      state().moved('bob', 0.1, 0.1);
    });
    act(() => {
      state().moved('bob', 0.9, 0.9);
    });

    expect(state().cursors).toEqual({ bob: { x: 0.9, y: 0.9 } });
  });

  // The first half of the done-when. The current state is only ever added to, so
  // a player who leaves keeps a cursor on everybody's screen — frozen where they
  // last moved it — for the rest of the round.
  it('drops the cursor of a player who has gone', () => {
    const { state, rerender } = mount('round-1', ['bob', 'cleo']);
    act(() => {
      state().moved('bob', 0.2, 0.2);
      state().moved('cleo', 0.8, 0.8);
    });

    rerender('round-1', ['cleo']);
    expect(Object.keys(state().cursors)).toEqual(['cleo']);
  });

  it('drops everyone when the room empties', () => {
    const { state, rerender } = mount('round-1', ['bob']);
    act(() => {
      state().moved('bob', 0.2, 0.2);
    });

    rerender('round-1', []);
    expect(state().cursors).toEqual({});
  });

  it('keeps the same object when the roster has not changed', () => {
    // A roster arrives on every ready toggle. Rebuilding the map each time would
    // re-render every cursor on screen for nothing.
    const { state, rerender } = mount('round-1', ['bob']);
    act(() => {
      state().moved('bob', 0.2, 0.2);
    });
    const before = state().cursors;

    rerender('round-1', ['bob']);
    expect(state().cursors).toBe(before);
  });

  it('forgets everything when the round changes', () => {
    const { state, rerender } = mount('round-1', ['bob']);
    act(() => {
      state().moved('bob', 0.2, 0.2);
    });

    rerender('round-2', ['bob']);
    expect(state().cursors).toEqual({});
  });
});

describe('8.5 — drawing them', () => {
  const bob: CursorView = { name: 'bob', colour: '#e63946', x: 0.25, y: 0.5 };

  const drawn = (name: string) =>
    document.querySelector<HTMLElement>(`[data-cursor="${name}"]`);

  it('draws nothing for nobody', () => {
    const { container } = render(<PlayerCursors cursors={[]} />);
    expect(container.textContent).toBe('');
  });

  // The second half of the done-when: the component renders without touching
  // `window`. The current one divides by `window.innerWidth` at render time,
  // which is a value that does not exist on a server and is a layout out of date
  // when it does.
  it('positions by percentage, and reads no window at all', () => {
    const width = vi.spyOn(globalThis, 'innerWidth', 'get');
    const height = vi.spyOn(globalThis, 'innerHeight', 'get');

    render(<PlayerCursors cursors={[bob]} />);

    expect(drawn('bob')?.style.left).toBe('25%');
    expect(drawn('bob')?.style.top).toBe('50%');
    expect(width).not.toHaveBeenCalled();
    expect(height).not.toHaveBeenCalled();
  });

  it('names the player, in their own colour', () => {
    render(<PlayerCursors cursors={[bob]} />);
    expect(screen.getByText('bob')).not.toBeNull();
    expect(drawn('bob')?.querySelector('path')?.getAttribute('fill')).toBe('#e63946');
  });

  it('glides at twice the send interval, not at a second and a half', () => {
    // 1,600 ms was tuned when this animated fake bots. Against a stream arriving
    // every 60 ms it shows where the player was more than a second ago.
    render(<PlayerCursors cursors={[bob]} />);
    expect(drawn('bob')?.style.transitionDuration).toBe(`${String(THROTTLE_MS * 2)}ms`);
  });

  it('is decoration, and says so', () => {
    const { container } = render(<PlayerCursors cursors={[bob]} />);
    const layer = container.firstElementChild;

    // Sixteen announcements a second of where somebody else's mouse is would
    // make the round unusable with a screen reader.
    expect(layer?.getAttribute('aria-hidden')).toBe('true');
    expect(layer?.className).toContain('pointer-events-none');
  });

  it('draws one per player', () => {
    render(
      <PlayerCursors
        cursors={[bob, { name: 'cleo', colour: '#457b9d', x: 0.9, y: 0.1 }]}
      />,
    );
    expect(drawn('bob')).not.toBeNull();
    expect(drawn('cleo')?.style.left).toBe('90%');
  });
});
