'use client';

// The scoreboard, built up a stage at a time.
//
// It owns the sequence and it announces the end of it. That is the whole of the
// fix: whoever wants to know when the reveal is over asks, rather than waiting
// 5,400 ms for a sequence that takes 5,100 and hoping.
//
// The rows are sorted at every stage, so a player who was leading on
// corrections and loses it on penalties is seen to lose it.
import { cn } from '@wikifake/ui';
import type { ScoreBreakdown } from '@wikifake/protocol';
import { useEffect, useState } from 'react';

import { scoreAtStage, STAGES, type Stage } from './stages.js';
import { useTimers } from '../../timers.js';

/** One player's final numbers, as the leaderboard reports them. */
export interface FinalStanding {
  readonly name: string;
  readonly colour: string;
  /** Null for a player who never submitted. */
  readonly breakdown: ScoreBreakdown | null;
  readonly you: boolean;
}

export interface AnimatedRankingProps {
  readonly standings: readonly FinalStanding[];
  /**
   * The stages, so a test can stretch them.
   *
   * Which is the point of the step: stretch these and the reveal that follows
   * still lands after the last one, because it is told rather than timed.
   */
  readonly stages?: readonly Stage[];
  /** Called once, when the last stage has landed. */
  onFinished(): void;
}

const ZERO: ScoreBreakdown = {
  truePositives: 0,
  falsePositives: 0,
  hintsUsed: 0,
  hintPenalty: 0,
  scoreStolen: 0,
  timeBonus: 0,
};

export function AnimatedRanking({
  standings,
  stages = STAGES,
  onFinished,
}: AnimatedRankingProps) {
  const timers = useTimers();
  const [stage, setStage] = useState(0);

  useEffect(() => {
    let at = 0;
    // One timer per stage, from the same list the labels come from. The end is
    // the last of them, so there is no total to keep in step with anything.
    for (const [index, step] of stages.entries()) {
      at += step.holds;
      timers.after(at, () => {
        setStage(index + 1);
        if (index === stages.length - 1) onFinished();
      });
    }
    return () => {
      timers.clear();
    };
    // `onFinished` is read rather than depended on: an inline closure would
    // restart the whole sequence on every render of the parent.
  }, [stages, timers]);

  const shown = stages[Math.min(stage, stages.length - 1)];
  const scored = standings
    .map((standing) => ({
      ...standing,
      score: scoreAtStage(standing.breakdown ?? ZERO, stage),
    }))
    // Sorted at every stage, and the name breaks a tie — the same total order
    // the live ranking uses, so the two never disagree about who is ahead.
    .sort((one, two) =>
      two.score === one.score ? one.name.localeCompare(two.name) : two.score - one.score,
    );

  return (
    <div>
      <p className="flex items-baseline justify-between gap-3">
        <span aria-live="polite" className="text-sm text-ink">
          {shown?.label}
        </span>
        <span className="font-mono text-[10px] tracking-[0.12em] text-muted uppercase">
          {String(Math.min(stage, stages.length))}/{String(stages.length)}
        </span>
      </p>
      <p className="mt-0.5 text-xs text-muted">{shown?.note}</p>

      <ol className="mt-4 space-y-2">
        {scored.map((standing, at) => (
          <li
            key={standing.name}
            className={cn(
              'grid grid-cols-[1.5rem_1fr_auto] items-center gap-3 rounded-lg px-2 py-1.5',
              'transition-colors',
              standing.you ? 'bg-accent-soft' : 'bg-transparent',
            )}
          >
            <span
              className={cn(
                'font-mono text-xs font-semibold tabular-nums',
                at === 0 ? 'text-bronze' : 'text-muted',
              )}
            >
              {String(at + 1).padStart(2, '0')}
            </span>
            <span className="truncate text-sm text-ink">
              {standing.name}
              {standing.you ? <span className="text-muted"> · you</span> : null}
              {standing.breakdown === null ? (
                <span className="text-muted"> · did not submit</span>
              ) : null}
            </span>
            <span className="font-mono text-sm font-semibold tabular-nums text-ink">
              {String(standing.score)}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
