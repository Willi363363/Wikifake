'use client';

// C5.5 — the cursors of a room: what arrives, and what this browser sends.
//
// The state is `round/cursors.ts`. Here is the transport, and the listener that
// feeds it: a `mousemove` on the window, paced, turned into a fraction of the
// viewport before it leaves.
//
// The viewport is read **in the listener**, which is a browser event and
// therefore a place where a window exists. That is the whole difference from the
// current game, which reads it while rendering.
import { useEffect } from 'react';

import {
  fractionOf,
  THROTTLE_MS,
  useCursors,
  type CursorsState,
} from '../round/cursors.js';
import { useRealtime, useRealtimeMessages } from '../realtime/provider.js';

/**
 * @param present the roster, so a player who leaves loses their cursor.
 * @param active false outside a round: there is nothing to point at, and a
 *   lobby does not need sixteen frames a second of anybody's mouse.
 */
export function useRoomCursors(
  roundKey: string,
  present: readonly string[],
  active: boolean,
): CursorsState {
  const { send } = useRealtime();
  const cursors = useCursors(roundKey, present);

  useRealtimeMessages((message) => {
    if (message.type !== 'cursor_update') return;
    cursors.moved(message.player, message.x, message.y);
  });

  useEffect(() => {
    if (!active) return undefined;

    let last = 0;
    const report = (event: MouseEvent): void => {
      // `Date.now` rather than `performance.now`: the two are interchangeable
      // for a throttle, and one of them is what a fake clock in a test moves.
      const now = Date.now();
      if (now - last < THROTTLE_MS) return;
      last = now;

      const spot = fractionOf(
        event.clientX,
        event.clientY,
        globalThis.innerWidth,
        globalThis.innerHeight,
      );
      send({ type: 'cursor', x: spot.x, y: spot.y });
    };

    globalThis.addEventListener('mousemove', report);
    return () => {
      globalThis.removeEventListener('mousemove', report);
    };
  }, [active, send]);

  return cursors;
}
