/** @vitest-environment jsdom */

// The waiting screen finishes itself.
//
// The criterion is "no more `forwardRef` or handle, and the screen leads into
// the round in solo as in multiplayer". Two of these tests are about the shape
// of the code and say so plainly — a handle is exactly the kind of thing that
// comes back when somebody is in a hurry, and the pitfall list for this phase
// names that temptation.
//
// The rest drive the clock: progress is a function of how long we have waited
// and whether the round has arrived, which is what makes the handle unnecessary
// in the first place.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { act, cleanup, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { GenerationScreen, SETTLE_MS } from './generation.js';
import { render } from '../i18n/testing.js';
import { APPROACH_MS, CEILING, progressAt, stageAt } from './progress.js';

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

const HERE = dirname(fileURLToPath(import.meta.url));

describe('7.5 — the progress, as arithmetic', () => {
  it('starts at nothing', () => {
    expect(progressAt(0, false)).toBe(0);
  });

  it('never passes its ceiling on its own', () => {
    expect(progressAt(APPROACH_MS, false)).toBeCloseTo(CEILING, 5);
    // A generation that takes a minute does not produce a bar past 85%: a bar
    // that reaches 100% before the article does is a bar that has lied.
    expect(progressAt(APPROACH_MS * 6, false)).toBeCloseTo(CEILING, 5);
  });

  it('is only finished by the round arriving', () => {
    expect(progressAt(0, true)).toBe(100);
    expect(progressAt(APPROACH_MS * 10, true)).toBe(100);
  });

  it('slows down as it goes, which is what makes the wait readable', () => {
    const early = progressAt(1000, false) - progressAt(0, false);
    const late = progressAt(APPROACH_MS, false) - progressAt(APPROACH_MS - 1000, false);
    expect(early).toBeGreaterThan(late);
  });

  it('never runs backwards, and never leaves the scale', () => {
    let last = -1;
    for (let at = 0; at <= APPROACH_MS * 2; at += 200) {
      const now = progressAt(at, false);
      expect(now).toBeGreaterThanOrEqual(last);
      expect(now).toBeLessThanOrEqual(100);
      last = now;
    }
  });

  it('names a stage for every point on the scale', () => {
    // A stage is a catalogue key since 11.2 — the copy lives in the catalogue,
    // and the screen resolves it. The English rendering is asserted below.
    for (let at = 0; at <= 100; at += 1) {
      expect(stageAt(at).length).toBeGreaterThan(0);
    }
    expect(stageAt(100)).toBe('ready');
  });
});

describe('7.5 — the generation screen', () => {
  const paint = (ready: boolean, onEnter = vi.fn()) => {
    render(
      <GenerationScreen topic="Chat" proposer="ada" ready={ready} onEnter={onEnter} />,
    );
    return onEnter;
  };

  it('shows the topic the server elected, and who proposed it', () => {
    paint(false);
    expect(screen.getByText('Chat')).not.toBeNull();
    expect(screen.getByText('proposed by ada')).not.toBeNull();
  });

  it('says the server drew it when nobody proposed it', () => {
    render(
      <GenerationScreen topic="Paris" proposer={null} ready={false} onEnter={vi.fn()} />,
    );
    expect(screen.getByText('drawn by the server')).not.toBeNull();
  });

  it('moves on its own while it waits', () => {
    paint(false);
    const bar = screen.getByRole('progressbar', { name: 'Generating the round' });
    expect(bar.getAttribute('aria-valuenow')).toBe('0');

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(Number(bar.getAttribute('aria-valuenow'))).toBeGreaterThan(0);
  });

  it('stops short of the end until the round is there', () => {
    paint(false);
    act(() => {
      vi.advanceTimersByTime(APPROACH_MS * 3);
    });

    const shown = Number(screen.getByRole('progressbar').getAttribute('aria-valuenow'));
    expect(shown).toBeLessThanOrEqual(CEILING);
  });

  // The criterion: the screen leads into the round. It decides when, rather
  // than being told by a handle.
  it('hands over once, after the bar has been seen to fill', () => {
    const entered = vi.fn();
    const { rerender } = render(
      <GenerationScreen topic="Chat" ready={false} onEnter={entered} />,
    );

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(entered).not.toHaveBeenCalled();

    rerender(<GenerationScreen topic="Chat" ready onEnter={entered} />);
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('100');
    // Not immediately: the bar is seen to fill first.
    expect(entered).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(SETTLE_MS);
    });
    expect(entered).toHaveBeenCalledTimes(1);
  });

  // A handle invoked twice pushes a player into a round they are already in.
  it('hands over exactly once, however many times it re-renders', () => {
    const entered = vi.fn();
    const { rerender } = render(
      <GenerationScreen topic="Chat" ready onEnter={entered} />,
    );

    act(() => {
      vi.advanceTimersByTime(SETTLE_MS * 4);
    });
    rerender(<GenerationScreen topic="Chat" ready onEnter={entered} />);
    act(() => {
      vi.advanceTimersByTime(SETTLE_MS * 4);
    });

    expect(entered).toHaveBeenCalledTimes(1);
  });

  // Step 7.6 hangs the launcher here: the wait is what it fills.
  it('offers something to play while the wait lasts', () => {
    paint(false);
    expect(screen.getByRole('button', { name: 'Play while you wait' })).not.toBeNull();
  });

  it('leaves no timer behind when it is unmounted', () => {
    const entered = vi.fn();
    const { unmount } = render(
      <GenerationScreen topic="Chat" ready={false} onEnter={entered} />,
    );

    unmount();
    act(() => {
      vi.advanceTimersByTime(APPROACH_MS);
    });
    expect(vi.getTimerCount()).toBe(0);
  });

  // The pitfall this phase names: "the temptation to port the handle just for
  // now — that is precisely what 7.5 removes".
  describe('the shape of it', () => {
    const source = readFileSync(join(HERE, 'generation.tsx'), 'utf8');

    // The call, not the word: the file's own comment explains that it uses
    // neither, and a search for the bare names finds that explanation.
    it.each(['forwardRef(', 'useImperativeHandle('])('calls no %s', (banned) => {
      expect(source).not.toContain(banned);
    });

    it('imports neither of them from React', () => {
      const imports = /import\s*\{([^}]*)\}\s*from\s*'react'/.exec(source)?.[1] ?? '';
      expect(imports).not.toContain('forwardRef');
      expect(imports).not.toContain('useImperativeHandle');
    });
  });
});
