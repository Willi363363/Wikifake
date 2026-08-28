'use client';

// Pattern match: the grid lights up, then asks what lit.
//
// The grading is a pure function, which is the whole game: which squares were
// right, which were invented, which were forgotten. The component shows a
// pattern, takes a guess of the same size, and grades it.
import { cn } from '@wikifake/ui';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { PlayAgain } from './controls.js';
import { useTimers } from '../timers.js';

/** A four by four grid. */
export const CELLS = 16;

/** How many squares light up, and the bounds difficulty moves between. */
export const EASIEST = 3;
export const HARDEST = 7;

/** How long the pattern is shown, and how long its grading stays up. */
const SHOWN_MS = 2200;
const GRADED_MS = 1600;

export type Mark = 'correct' | 'wrong' | 'missed';
export type Phase = 'showing' | 'recalling' | 'graded';

/**
 * How a guess did.
 *
 * Only squares that matter are in the map: a square nobody chose and nothing lit
 * has nothing to say about it.
 */
export function gradeOf(
  pattern: ReadonlySet<number>,
  chosen: ReadonlySet<number>,
): ReadonlyMap<number, Mark> {
  const marks = new Map<number, Mark>();
  for (const at of chosen) marks.set(at, pattern.has(at) ? 'correct' : 'wrong');
  for (const at of pattern) if (!chosen.has(at)) marks.set(at, 'missed');
  return marks;
}

/** A guess is perfect when nothing was invented and nothing forgotten. */
export function isPerfect(marks: ReadonlyMap<number, Mark>): boolean {
  return [...marks.values()].every((mark) => mark === 'correct');
}

/** Harder after a perfect round, easier after a miss, and never outside bounds. */
export function nextDifficulty(current: number, perfect: boolean): number {
  return perfect ? Math.min(HARDEST, current + 1) : Math.max(EASIEST, current - 1);
}

/**
 * `size` distinct squares.
 *
 * `pick` chooses a square below `CELLS`; a test hands in a sequence, the game
 * hands in `Math.random`. It draws until it has enough distinct squares, which
 * terminates because `size` is never more than `HARDEST`.
 */
export function drawPattern(
  size: number,
  pick: (below: number) => number,
): ReadonlySet<number> {
  const lit = new Set<number>();
  let guard = 0;
  while (lit.size < size && guard < CELLS * 100) {
    lit.add(pick(CELLS));
    guard += 1;
  }
  return lit;
}

export function PatternMatch() {
  const t = useTranslations('waiting');
  const timers = useTimers();
  const [round, setRound] = useState(0);
  const [difficulty, setDifficulty] = useState(EASIEST);
  const [phase, setPhase] = useState<Phase>('showing');
  const [pattern, setPattern] = useState<ReadonlySet<number>>(new Set());
  const [chosen, setChosen] = useState<ReadonlySet<number>>(new Set());
  const [marks, setMarks] = useState<ReadonlyMap<number, Mark> | null>(null);

  const again = (): void => {
    timers.clear();
    setRound((was) => was + 1);
  };

  // One effect per round, and the round number is the only thing that starts
  // one: two overlapping rounds is how the current game manages to show a
  // pattern while grading the last one.
  useEffect(() => {
    setPattern(drawPattern(difficulty, (below) => Math.floor(Math.random() * below)));
    setChosen(new Set());
    setMarks(null);
    setPhase('showing');
    return timers.after(SHOWN_MS, () => {
      setPhase('recalling');
    });
    // `difficulty` is read here and deliberately not depended on: it changes as
    // a round is graded, and re-running would restart the round being graded.
  }, [round, timers]);

  const choose = (at: number): void => {
    if (phase !== 'recalling') return;
    const next = new Set(chosen);
    if (next.has(at)) next.delete(at);
    else next.add(at);
    setChosen(next);

    if (next.size < pattern.size) return;

    const graded = gradeOf(pattern, next);
    const perfect = isPerfect(graded);
    setMarks(graded);
    setPhase('graded');
    setDifficulty((was) => nextDifficulty(was, perfect));
    timers.after(GRADED_MS, () => {
      setRound((was) => was + 1);
    });
  };

  const toneOf = (at: number): string => {
    if (phase === 'showing') {
      return pattern.has(at) ? 'border-accent bg-accent' : 'border-line bg-surface';
    }
    if (phase === 'graded') {
      const mark = marks?.get(at);
      if (mark === 'correct') return 'border-green bg-green-soft';
      if (mark === 'wrong') return 'border-danger bg-danger-soft';
      if (mark === 'missed') return 'border-warn bg-warn-soft';
      return 'border-line bg-surface';
    }
    return chosen.has(at)
      ? 'border-accent-line bg-accent-soft'
      : 'border-line bg-surface';
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="grid grid-cols-4 gap-1.5" role="group" aria-label={t('pattern.gridLabel')}>
        {Array.from({ length: CELLS }, (_, at) => (
          <button
            key={at}
            type="button"
            onClick={() => {
              choose(at);
            }}
            disabled={phase !== 'recalling'}
            aria-pressed={chosen.has(at)}
            aria-label={t('pattern.square', { number: at + 1 })}
            className={cn(
              'size-12 rounded-md border transition-colors',
              'outline-none focus-visible:ring-2 focus-visible:ring-accent',
              'enabled:hover:border-accent-line',
              toneOf(at),
            )}
          />
        ))}
      </div>
      <p className="text-sm text-muted" aria-live="polite">
        {phase === 'showing'
          ? t('pattern.memorise')
          : phase === 'recalling'
            ? t('pattern.pick', { count: pattern.size })
            : marks !== null && isPerfect(marks)
              ? t('pattern.perfect')
              : t('pattern.notQuite')}
      </p>
      <p className="font-mono text-xs tabular-nums text-muted">
        {t('pattern.progress', { level: difficulty - EASIEST + 1, round: round + 1 })}
      </p>
      <PlayAgain onClick={again} />
    </div>
  );
}
