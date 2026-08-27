'use client';

// The screen that fills the wait while a round is generated.
//
// No `forwardRef`, and no `useImperativeHandle`. The current one exposes
// `ready(data)` so the lobby can reach in and finish it — which was itself an
// improvement on the `window.__waitingScreenReady` global it replaced, and is
// still a component reaching into another component's insides. Here the round's
// arrival is a prop, the progress is a function of the clock, and the screen
// announces when it is done.
//
// It is the same screen in solo and in multiplayer. What differs is who decides
// `ready`: a socket message in one, a resolved request in the other, and neither
// is this component's business.
import { Badge, Progress } from '@wikifake/ui';
import { useEffect, useRef, useState } from 'react';

import { progressAt, stageAt } from './progress.js';
import { GameLauncher } from '../waiting/launcher.js';

/** How often the bar moves. The current interval, kept. */
const TICK_MS = 200;

/** The pause on 100% before the round takes over, so the bar is seen to fill. */
export const SETTLE_MS = 700;

export interface GenerationScreenProps {
  readonly topic: string;
  /** Who proposed it, or null when the server drew it. */
  readonly proposer?: string | null;
  /** True once the round exists — `game_start` in a room, a response in solo. */
  readonly ready: boolean;
  /** Called once, after the bar has been seen to fill. */
  onEnter(): void;
}

export function GenerationScreen({
  topic,
  proposer,
  ready,
  onEnter,
}: GenerationScreenProps) {
  const [elapsed, setElapsed] = useState(0);
  const entered = useRef(false);
  const enter = useRef(onEnter);
  enter.current = onEnter;

  useEffect(() => {
    if (ready) return undefined;
    const timer = setInterval(() => {
      setElapsed((was) => was + TICK_MS);
    }, TICK_MS);
    return () => {
      clearInterval(timer);
    };
  }, [ready]);

  useEffect(() => {
    if (!ready || entered.current) return undefined;
    const timer = setTimeout(() => {
      // Once. A second call would push the player into a round they are already
      // in, which is what a handle invoked twice does today.
      entered.current = true;
      enter.current();
    }, SETTLE_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [ready]);

  const progress = progressAt(elapsed, ready);

  return (
    <div className="rounded-xl border border-line bg-surface p-6 text-center shadow-md">
      <p className="text-xs tracking-widest text-muted uppercase">Topic</p>
      <p className="mt-1 text-xl text-ink">{topic}</p>
      <p className="mt-1 text-sm text-muted">
        {proposer === null || proposer === undefined
          ? 'drawn by the server'
          : `proposed by ${proposer}`}
      </p>

      <div className="mt-6 space-y-2">
        <Progress
          value={Math.round(progress)}
          max={100}
          aria-label="Generating the round"
        />
        <p className="flex items-baseline justify-between text-sm text-muted">
          {/* Announced, so a player who cannot see the bar is told the wait is
              progressing rather than left with a silent screen. */}
          <span aria-live="polite">{stageAt(progress)}</span>
          <span className="font-mono tabular-nums">{Math.round(progress)}%</span>
        </p>
      </div>

      <p className="mt-6">
        <Badge tone={ready ? 'green' : 'bronze'}>
          {ready ? 'the round is ready' : 'this takes a few seconds'}
        </Badge>
      </p>

      {/* The launcher is mounted here rather than beside the screen: it is the
          wait it fills, and a launcher that outlives the wait is a game a player
          is still playing when the round starts. */}
      <GameLauncher />
    </div>
  );
}
