/** @vitest-environment jsdom */

// Timers that die with the component that made them.
//
// The step's criterion — "no surviving timer after unmount" — rests on this
// hook, so it is tested on its own rather than only through six games: a leak
// found here says which of the two schedulers is wrong, and a leak found in a
// game only says that something is.
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useTimers, type Timers } from './timers.js';

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

/** Mounts the hook and hands its handle back. */
function mount(): { timers: Timers; unmount: () => void } {
  // A box rather than a bare variable: a variable assigned only inside `Host`
  // reads to the compiler as still null once `render` returns.
  const box: { held: Timers | null } = { held: null };
  function Host() {
    box.held = useTimers();
    return null;
  }
  const { unmount } = render(<Host />);
  const timers = box.held;
  if (timers === null) throw new Error('the hook did not run');
  return { timers, unmount };
}

describe('7.6 — timers that die with their component', () => {
  it('runs a one-shot once', () => {
    const { timers } = mount();
    const ran = vi.fn();
    act(() => {
      timers.after(100, ran);
    });

    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(ran).toHaveBeenCalledTimes(1);
  });

  it('runs a repeat until it is cancelled', () => {
    const { timers } = mount();
    const ran = vi.fn();
    let stop = (): void => undefined;
    act(() => {
      stop = timers.every(100, ran);
    });

    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(ran).toHaveBeenCalledTimes(3);

    act(() => {
      stop();
      vi.advanceTimersByTime(300);
    });
    expect(ran).toHaveBeenCalledTimes(3);
  });

  it('cancels a one-shot that has not fired', () => {
    const { timers } = mount();
    const ran = vi.fn();
    act(() => {
      timers.after(100, ran)();
      vi.advanceTimersByTime(500);
    });
    expect(ran).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('clears everything at once', () => {
    const { timers } = mount();
    const once = vi.fn();
    const over = vi.fn();
    act(() => {
      timers.after(100, once);
      timers.every(100, over);
      timers.clear();
      vi.advanceTimersByTime(1000);
    });

    expect(once).not.toHaveBeenCalled();
    expect(over).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  // The criterion of the step, in one assertion.
  it('leaves nothing behind when its component goes', () => {
    const { timers, unmount } = mount();
    const ran = vi.fn();
    act(() => {
      timers.after(100, ran);
      timers.after(5000, ran);
      timers.every(50, ran);
    });
    expect(vi.getTimerCount()).toBeGreaterThan(0);

    unmount();
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(vi.getTimerCount()).toBe(0);
    expect(ran).not.toHaveBeenCalled();
  });

  it('forgets a one-shot that has already fired', () => {
    const { timers } = mount();
    act(() => {
      timers.after(10, vi.fn());
      vi.advanceTimersByTime(50);
      // Nothing to cancel, and cancelling anyway is not an error.
      timers.clear();
    });
    expect(vi.getTimerCount()).toBe(0);
  });
});
