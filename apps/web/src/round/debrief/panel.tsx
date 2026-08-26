'use client';

// C1.2 — the debrief: the only place the solution appears.
//
// It waits for the ranking to say it is finished. Nothing here knows how long
// that takes, which is the difference from the current debrief: it waits 5,400 ms
// for a sequence of 5,100, and one edit to either number desynchronises them
// with no test able to notice.
//
// And it is a **panel, not an overlay**. The current one is a fixed full-screen
// modal, which covers the article — and with it the CC BY-SA attribution that
// C6.1 requires to stay visible *after* the round as well as during it. Here the
// debrief sits above the article, and the article keeps its verdicts and its
// attribution underneath.
import type { FalsifiedPosition, ScoreBreakdown } from '@wikifake/protocol';
import { Badge, Button, Separator } from '@wikifake/ui';
import { useState } from 'react';

import { AnimatedRanking, type FinalStanding } from './ranking.js';
import { accuracyOf, gradeFor, type Stage } from './stages.js';

export interface DebriefProps {
  /** This player's numbers, as the server recorded them. */
  readonly breakdown: ScoreBreakdown;
  readonly score: number;
  readonly totalFakes: number;
  /** C1.2 — arrives with `game_end`, or with the submission's answer. */
  readonly solution: readonly FalsifiedPosition[];
  /** Everyone's numbers. One entry in solo. */
  readonly standings: readonly FinalStanding[];
  readonly stages?: readonly Stage[] | undefined;
  /** What to offer at the end: another round, or the way back to the lobby. */
  readonly onwardLabel: string;
  onOnward(): void;
}

const ROWS: readonly {
  readonly label: string;
  readonly of: keyof ScoreBreakdown;
  readonly against?: true;
}[] = [
  { label: 'Found', of: 'truePositives' },
  { label: 'Wrongly marked', of: 'falsePositives', against: true },
  { label: 'Hints used', of: 'hintsUsed' },
  { label: 'Hint penalty', of: 'hintPenalty', against: true },
  { label: 'Stolen from you', of: 'scoreStolen', against: true },
  { label: 'Time bonus', of: 'timeBonus' },
];

export function Debrief({
  breakdown,
  score,
  totalFakes,
  solution,
  standings,
  stages,
  onwardLabel,
  onOnward,
}: DebriefProps) {
  const [revealed, setRevealed] = useState(false);
  const accuracy = accuracyOf(breakdown, totalFakes);
  const grade = gradeFor(accuracy);
  const missed = Math.max(0, totalFakes - breakdown.truePositives);

  return (
    <section
      aria-label="Debrief"
      className="rounded-xl border border-line bg-surface p-6 shadow-md"
    >
      <AnimatedRanking
        standings={standings}
        {...(stages === undefined ? {} : { stages })}
        onFinished={() => {
          setRevealed(true);
        }}
      />

      {!revealed ? null : (
        <div className="animate-fade-in">
          <Separator className="my-6" />

          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <p>
              <Badge tone={grade.tone}>{grade.label}</Badge>
              <span className="ml-2 text-sm text-muted">{grade.note}</span>
            </p>
            <p className="font-mono text-4xl tabular-nums text-ink" aria-live="polite">
              {String(score)}
              <span className="ml-1 text-sm text-muted">points</span>
            </p>
          </div>

          <dl className="mt-5 space-y-2 text-sm">
            {ROWS.map((row) => {
              const value = breakdown[row.of];
              return (
                <div key={row.of} className="flex items-baseline justify-between gap-3">
                  <dt className="text-muted">{row.label}</dt>
                  <dd className="font-mono tabular-nums text-ink">
                    {row.against === true && value > 0
                      ? `−${String(value)}`
                      : String(value)}
                  </dd>
                </div>
              );
            })}
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-muted">Let through</dt>
              <dd className="font-mono tabular-nums text-ink">{String(missed)}</dd>
            </div>
          </dl>

          <Separator className="my-6" />

          {/* C1.2 — every falsification, and the truth behind it. This is the
              first moment any of it has been on this client at all. */}
          <h3 id="what-was-altered" className="text-sm font-medium text-ink">
            What was altered
          </h3>
          <ol aria-labelledby="what-was-altered" className="mt-3 space-y-4">
            {solution.map((position) => (
              <li key={position.falseInfoNumber} className="text-sm">
                <p className="font-mono text-[10px] tracking-[0.12em] text-muted uppercase">
                  paragraph {String(position.paragraphIndex)}
                </p>
                <p className="mt-1 text-ink italic">“{position.falseStatement}”</p>
                <p className="mt-1 text-ink-2">{position.explanation}</p>
              </li>
            ))}
          </ol>

          <Button variant="primary" size="lg" className="mt-6 w-full" onClick={onOnward}>
            {onwardLabel}
          </Button>
        </div>
      )}
    </section>
  );
}
