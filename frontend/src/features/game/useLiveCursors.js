/**
 * Shares mouse positions between players in a room.
 *
 * Positions travel as viewport fractions so they land in the right place on
 * screens of different sizes, and outgoing moves are throttled to ~16/s to keep
 * the socket quiet.
 */
import { useState, useEffect } from 'react';
import { send } from '../../lib/ws.js';

const THROTTLE_MS = 60;

export function useLiveCursors(socket, active) {
  const [cursors, setCursors] = useState({});

  useEffect(() => {
    if (!active || !socket) return undefined;
    let last = 0;

    const onMouseMove = (event) => {
      const now = performance.now();
      if (now - last <= THROTTLE_MS) return;
      last = now;
      send(socket, 'cursor', {
        x: event.clientX / window.innerWidth,
        y: event.clientY / window.innerHeight,
      });
    };

    window.addEventListener('mousemove', onMouseMove);
    return () => window.removeEventListener('mousemove', onMouseMove);
  }, [socket, active]);

  /** Call from the room's message handler when a `cursor_update` arrives. */
  const trackCursor = (player, x, y) => setCursors((prev) => ({ ...prev, [player]: { x, y } }));

  return { cursors, trackCursor };
}
