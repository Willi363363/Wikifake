/** @vitest-environment jsdom */

// The sheets themselves: that each one is drawn, that a screen reader is told
// what happened, and the two fixes this step names — nothing random during
// render, and a canvas that stops for a viewer who asked for less motion.
import { cleanup, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Overlays } from './overlays.js';
import { CONFETTI, useParticles } from './particles.js';
import type { Overlay } from '../effects.js';
import { Static } from './static.js';
import { REDUCED_MOTION } from '../reduced-motion.js';
import { render } from '../../i18n/testing.js';

/** Every overlay the table can produce. */
const OVERLAYS: readonly Overlay[] = [
  'fog',
  'earthquake',
  'blackout',
  'blizzard',
  'lightning',
  'static',
  'confetti',
  'rickroll',
];

/** Answers `matchMedia` for the reduced-motion query, and nothing else. */
function preference(reduced: boolean): void {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: query === REDUCED_MOTION && reduced,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

beforeEach(() => {
  preference(false);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  cleanup();
});

describe('8.4 — the switchboard', () => {
  it('draws nothing when nothing is running', () => {
    const { container } = render(<Overlays active={new Set()} onDismiss={vi.fn()} />);
    expect(container.textContent).toBe('');
  });

  // Exhaustive: the current game wires eight overlays by hand in `GameSession`,
  // which is where one would quietly go missing.
  it.each(OVERLAYS)('draws %s, and says what it is', (overlay) => {
    render(<Overlays active={new Set([overlay])} onDismiss={vi.fn()} />);

    const said = screen.getByRole('status');
    expect(said.getAttribute('aria-label')?.length).toBeGreaterThan(0);
  });

  it('draws two at once', () => {
    render(<Overlays active={new Set(['fog', 'confetti'])} onDismiss={vi.fn()} />);
    expect(screen.getAllByRole('status')).toHaveLength(2);
  });

  it('keeps the pop-up above the static, whatever order they arrived in', () => {
    render(<Overlays active={new Set(['rickroll', 'static'])} onDismiss={vi.fn()} />);

    const labels = screen
      .getAllByRole('status')
      .map((each) => each.getAttribute('aria-label'));
    expect(labels.at(-1)).toContain('pop-up');
  });

  it('lets the pop-up be closed, and only the pop-up', () => {
    const dismissed = vi.fn();
    render(<Overlays active={new Set(['rickroll'])} onDismiss={dismissed} />);

    screen.getByRole('button', { name: 'Close it' }).click();
    expect(dismissed).toHaveBeenCalledWith('rickroll');
  });

  it('lets every other sheet be clicked through', () => {
    // An item that makes the article hard to read is not an item that stops the
    // player marking a paragraph. The current blur does both.
    render(<Overlays active={new Set(['fog', 'static'])} onDismiss={vi.fn()} />);

    for (const sheet of screen.getAllByRole('status')) {
      expect(sheet.className).toContain('pointer-events-none');
    }
  });
});

describe('8.4 — nothing random during render', () => {
  /** Every value the hook returned, in order. */
  function record(): readonly (readonly unknown[])[] {
    const seen: (readonly unknown[])[] = [];
    function Host() {
      seen.push(useParticles(CONFETTI, false));
      return null;
    }
    render(<Host />);
    return seen;
  }

  it('returns nothing on the first render, and the pieces on the next', () => {
    const seen = record();

    // This is what makes it safe to render on a server: the first paint here and
    // the markup the server produced agree, because both have no particles at
    // all. The current components build them in a render-time `useMemo` that
    // calls `Math.random()`, so the two disagree by construction.
    expect(seen[0]).toEqual([]);
    expect(seen.at(-1)?.length).toBe(CONFETTI.count);
  });

  it('calls no randomness on the render that the server also produces', () => {
    const rolled = vi.spyOn(Math, 'random');
    let onFirstRender: number | null = null;

    function Host() {
      useParticles(CONFETTI, false);
      // The first render only: by the second, the effect has run and the
      // particles exist, which is the whole point.
      onFirstRender ??= rolled.mock.calls.length;
      return null;
    }
    render(<Host />);

    expect(onFirstRender).toBe(0);
    expect(rolled).toHaveBeenCalled();
  });

  it('scatters nothing at all for a viewer who asked for less motion', () => {
    // The fall is `snowfall`, which the stylesheet switches off. A hundred and
    // twenty motionless flakes piled at the top edge is worse than none.
    preference(true);
    render(<Overlays active={new Set(['confetti'])} onDismiss={vi.fn()} />);
    expect(screen.getByRole('status').querySelectorAll('span')).toHaveLength(0);
  });
});

describe('8.4 — the static, and the preference a stylesheet cannot reach', () => {
  /** A 2D context jsdom does not provide. */
  function fakeCanvas() {
    const putImageData = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      createImageData: (width: number, height: number) => ({
        data: new Uint8ClampedArray(width * height * 4),
      }),
      putImageData,
    } as unknown as CanvasRenderingContext2D);
    return putImageData;
  }

  it('draws one frame and starts no loop when less motion is asked for', () => {
    // Twenty-five frames a second of full-screen noise is a photosensitivity
    // hazard, and it is the one thing `motion.css` has no reach over.
    preference(true);
    const painted = fakeCanvas();
    const asked = vi.spyOn(globalThis, 'requestAnimationFrame');

    render(<Static />);

    expect(painted).toHaveBeenCalledTimes(1);
    expect(asked).not.toHaveBeenCalled();
  });

  it('runs the loop otherwise', () => {
    fakeCanvas();
    const asked = vi.spyOn(globalThis, 'requestAnimationFrame');

    render(<Static />);
    expect(asked).toHaveBeenCalled();
  });

  it('cancels the loop when it goes', () => {
    fakeCanvas();
    const cancelled = vi.spyOn(globalThis, 'cancelAnimationFrame');

    const { unmount } = render(<Static />);
    unmount();

    // A `requestAnimationFrame` loop that outlives its component runs until the
    // tab is closed, and this one allocates a viewport-sized `ImageData` a frame.
    expect(cancelled).toHaveBeenCalled();
  });

  it('reads the viewport in the effect, not while rendering', () => {
    fakeCanvas();
    const width = vi.spyOn(globalThis, 'innerWidth', 'get').mockReturnValue(800);
    let readBeforeMount: number | null = null;

    function Host() {
      readBeforeMount ??= width.mock.calls.length;
      return <Static />;
    }
    render(<Host />);

    // `window` does not exist while this renders on the server, and a canvas
    // sized during render is sized from whatever the previous layout was.
    expect(readBeforeMount).toBe(0);
    expect(width).toHaveBeenCalled();
  });
});
