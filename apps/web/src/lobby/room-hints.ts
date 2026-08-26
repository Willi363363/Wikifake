'use client';

// The hints of a room, over the socket.
//
// The state and its one rule are `round/hints.ts`, shared with solo. What is
// here is the transport: `unlock_hint` goes out, `hint_unlocked` comes back, and
// an `error` with `hints_blocked` is a refusal that means something specific
// rather than a sentence to display.
//
// Separate from `useRoom` because it is not the lobby: the lobby's job is the
// roster and the phase, and a hook that also owned the hint ledger would be the
// place every future round feature ended up.
import { useCallback } from 'react';

import { useHints, type HintsState } from '../round/hints.js';
import { useRealtime, useRealtimeMessages } from '../realtime/provider.js';

export interface RoomHints extends HintsState {
  unlock(falseInfoNumber: number, level: 1 | 2): void;
}

/**
 * @param roundKey the round in progress. Changing it clears what was bought,
 *   which is the fix of this step: keyed on `totalFakes`, two consecutive rounds
 *   with the same count would share a ledger.
 */
export function useRoomHints(roundKey: string): RoomHints {
  const { send } = useRealtime();
  const hints = useHints(roundKey);

  useRealtimeMessages((message) => {
    if (message.type === 'hint_unlocked') {
      // The payload is the REST response with a `type` on it, which is why the
      // two transports share a hook at all.
      const { type: _relayed, ...payload } = message;
      hints.apply(payload);
      return;
    }
    // C1.5 — the only refusal this hook acts on. Everything else an `error`
    // carries is the room's business, and `useRoom` shows it.
    if (message.type === 'error' && message.code === 'hints_blocked') hints.block();
  });

  const unlock = useCallback(
    (falseInfoNumber: number, level: 1 | 2) => {
      send({ type: 'unlock_hint', falseInfoNumber, level });
    },
    [send],
  );

  return { ...hints, unlock };
}
