'use client';

// D6 — the live ranking, over the socket, paced on the way out.
//
// The pacing is the same number the server enforces, imported from the contract
// rather than guessed at: sending faster than the floor is sending messages that
// are dropped. What it is *not* is a leading-edge throttle. The last change has
// to arrive — a score that stops one tick short of the truth is a score that is
// simply wrong for the rest of the round — so a change inside the window is held
// and sent when the window closes.
import { LIVE_SCORE_MIN_INTERVAL_MS } from '@wikifake/protocol';
import { useCallback, useRef } from 'react';

import { useLiveScores, type LiveScoresState } from '../round/leaderboard.js';
import { useRealtime, useRealtimeMessages } from '../realtime/provider.js';
import { useTimers } from '../timers.js';

export interface RoomLeaderboard extends LiveScoresState {
  /** This player's score changed. Sent when the floor allows it. */
  publish(score: number): void;
}

export function useRoomLeaderboard(roundKey: string): RoomLeaderboard {
  const { send } = useRealtime();
  const timers = useTimers();
  const scores = useLiveScores(roundKey);

  const wanted = useRef<number | null>(null);
  const sentAt = useRef(0);
  const held = useRef<(() => void) | null>(null);

  useRealtimeMessages((message) => {
    if (message.type !== 'live_score_update') return;
    scores.report(message.player, message.score);
  });

  const flush = useCallback(() => {
    held.current = null;
    const score = wanted.current;
    if (score === null) return;
    wanted.current = null;
    sentAt.current = Date.now();
    send({ type: 'live_score', score });
  }, [send]);

  const publish = useCallback(
    (score: number) => {
      wanted.current = score;
      const since = Date.now() - sentAt.current;
      if (since >= LIVE_SCORE_MIN_INTERVAL_MS) {
        flush();
        return;
      }
      // Already holding one: the newer value replaces it and the same timer
      // sends it, so a player ticking quickly produces one message per window
      // rather than one per tick.
      held.current ??= timers.after(LIVE_SCORE_MIN_INTERVAL_MS - since, flush);
    },
    [flush, timers],
  );

  return { ...scores, publish };
}
