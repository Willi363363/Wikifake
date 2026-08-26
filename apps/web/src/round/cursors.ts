'use client';

// C5.5 — the other players' pointers.
//
// Positions are **fractions of the viewport**, from the wire to the style
// attribute. The current game divides by `window.innerWidth` at render time
// (`GameSession.jsx:348`), which is two bugs in one line: `window` does not
// exist while a component renders on a server, and a value read during render is
// read from whatever the last layout was rather than from this one.
//
// A fraction needs no window at all. `left: 42%` is the browser's arithmetic,
// done at paint, against the box that is actually there.
import { useCallback, useEffect, useState } from 'react';

/** Where a pointer is, in fractions of the viewport. Both in `[0,1]`. */
export interface Spot {
  readonly x: number;
  readonly y: number;
}

/** By player name. The server never echoes a player their own cursor. */
export type Cursors = Readonly<Record<string, Spot>>;

/**
 * How often a move is sent, in milliseconds. The current throttle, kept.
 *
 * C5.5 says the server throttles too, and that is the one that counts: a client
 * that stops pacing itself is a client the server slows down rather than a room
 * that floods.
 */
export const THROTTLE_MS = 60;

/**
 * A pointer position as a fraction, clamped.
 *
 * Clamped here as well as by `cursorCoordinate` on the way in, because a
 * negative fraction is a cursor drawn off the left edge of everyone else's
 * screen and the round trip is not the place to find that out.
 */
export function fractionOf(
  clientX: number,
  clientY: number,
  width: number,
  height: number,
): Spot {
  const bounded = (value: number, of: number): number =>
    of <= 0 ? 0 : Math.max(0, Math.min(1, value / of));
  return { x: bounded(clientX, width), y: bounded(clientY, height) };
}

export interface CursorsState {
  readonly cursors: Cursors;
  /** A `cursor_update` arrived. */
  moved(player: string, x: number, y: number): void;
  /** Keeps only the players named. Everyone else has gone. */
  keep(present: readonly string[]): void;
}

const NOBODY: Cursors = {};

/**
 * The cursors of one round.
 *
 * `present` is the roster, and it is what closes the second leak this step
 * names: the current state is only ever added to, so a player who leaves keeps a
 * cursor on everybody's screen — frozen where they last moved it — for the rest
 * of the round.
 */
export function useCursors(roundKey: string, present: readonly string[]): CursorsState {
  const [cursors, setCursors] = useState<Cursors>(NOBODY);

  useEffect(() => {
    setCursors(NOBODY);
  }, [roundKey]);

  const keep = useCallback((names: readonly string[]) => {
    setCursors((was) => {
      const held = new Set(names);
      const left = Object.entries(was).filter(([name]) => held.has(name));
      // A new object only when something actually went, so a roster that arrives
      // unchanged — which it does on every ready toggle — does not re-render
      // every cursor on screen.
      return left.length === Object.keys(was).length ? was : Object.fromEntries(left);
    });
  }, []);

  // The roster as a value, so an array rebuilt on every render does not re-run
  // this on every render.
  const roster = present.join(' ');
  useEffect(() => {
    keep(roster === '' ? [] : roster.split(' '));
  }, [keep, roster]);

  const moved = useCallback((player: string, x: number, y: number) => {
    setCursors((was) => ({ ...was, [player]: { x, y } }));
  }, []);

  return { cursors, moved, keep };
}
