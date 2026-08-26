'use client';

// Timers that die with the component that made them.
//
// Every minigame here runs on `setTimeout` and `setInterval`, and the current
// ones leak: `MemoryCards` schedules the pair resolution and never cancels it,
// `PatternMatch` schedules the next round and cancels only the last one it
// scheduled, `TicTacToe` schedules its own reset, and `DinoRun` opens an
// interval per jump that nothing cancels at all. A player who leaves the
// waiting screen mid-jump leaves that interval behind, still calling `setState`
// on a component that is gone.
//
// The step's completion criterion is "no surviving timer after unmount", so the
// bookkeeping lives in one place rather than in six sets of cleanup functions
// that each have to be right.
import { useCallback, useEffect, useMemo, useRef } from 'react';

export interface Timers {
  /** Runs once, unless the component goes first. Returns a canceller. */
  after(ms: number, run: () => void): () => void;
  /** Runs until cancelled, or until the component goes. */
  every(ms: number, run: () => void): () => void;
  /** Cancels everything still scheduled. */
  clear(): void;
}

export function useTimers(): Timers {
  // A set of cancellers rather than of ids: a timeout and an interval are
  // cancelled by different functions, and remembering which id is which is
  // exactly the detail that goes wrong once and then goes on being wrong
  // quietly.
  const live = useRef(new Set<() => void>());

  const after = useCallback((ms: number, run: () => void): (() => void) => {
    const id = setTimeout(() => {
      live.current.delete(stop);
      run();
    }, ms);
    const stop = (): void => {
      clearTimeout(id);
      live.current.delete(stop);
    };
    live.current.add(stop);
    return stop;
  }, []);

  const every = useCallback((ms: number, run: () => void): (() => void) => {
    const id = setInterval(run, ms);
    const stop = (): void => {
      clearInterval(id);
      live.current.delete(stop);
    };
    live.current.add(stop);
    return stop;
  }, []);

  const clear = useCallback((): void => {
    // Over a copy: each `stop` removes itself from the set we would otherwise
    // be walking.
    for (const stop of [...live.current]) stop();
  }, []);

  useEffect(() => clear, [clear]);

  return useMemo(() => ({ after, every, clear }), [after, every, clear]);
}
