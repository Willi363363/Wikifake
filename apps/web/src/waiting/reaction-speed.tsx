'use client';

// Reaction speed: wait for the target, then hit it.
//
// The measurement is `Date.now()` rather than `performance.now()`, and
// deliberately: the fake clock a test drives moves `Date.now()`, so "advance
// 250 ms, then click" measures 250 ms. A millisecond of resolution is finer
// than any hand, and a reaction time nobody can check is a reaction time worth
// nothing.
import { Badge } from '@wikifake/ui';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { PlayAgain } from './controls.js';
import { useTimers } from '../timers.js';

/** The wait before the target shows: long enough that it cannot be predicted. */
const WAIT_MS = 1000;
const WAIT_JITTER_MS = 2500;

/** How long a result stays up, and how long a false start is called out. */
const RESULT_MS = 1500;
const EARLY_MS = 1200;

/** The thresholds the time is coloured by. */
export const QUICK_MS = 250;
export const FAIR_MS = 400;

export type Phase = 'waiting' | 'target' | 'hit' | 'early';

export function toneFor(ms: number): 'green' | 'accent' | 'bronze' {
  if (ms < QUICK_MS) return 'green';
  if (ms < FAIR_MS) return 'accent';
  return 'bronze';
}

interface Spot {
  readonly x: number;
  readonly y: number;
}

export function ReactionSpeed() {
  const t = useTranslations('waiting');
  const timers = useTimers();
  const [round, setRound] = useState(0);
  const [phase, setPhase] = useState<Phase>('waiting');
  const [spot, setSpot] = useState<Spot>({ x: 50, y: 50 });
  const [shownAt, setShownAt] = useState(0);
  const [last, setLast] = useState<number | null>(null);
  const [best, setBest] = useState<number | null>(null);

  const again = (): void => {
    timers.clear();
    setPhase('waiting');
    setLast(null);
    setRound((was) => was + 1);
  };

  // One effect per round: the round number is the only thing that starts a new
  // wait, so there is exactly one pending target at a time.
  useEffect(() => {
    setPhase('waiting');
    return timers.after(WAIT_MS + Math.random() * WAIT_JITTER_MS, () => {
      setSpot({ x: 15 + Math.random() * 70, y: 15 + Math.random() * 70 });
      setShownAt(Date.now());
      setPhase('target');
    });
  }, [round, timers]);

  const hit = (): void => {
    if (phase !== 'target') return;
    // Rounded: a reaction time is not measured to a fraction of a millisecond.
    const took = Math.round(Date.now() - shownAt);
    setLast(took);
    setBest((was) => (was === null || took < was ? took : was));
    setPhase('hit');
    timers.after(RESULT_MS, () => {
      setRound((was) => was + 1);
    });
  };

  const early = (): void => {
    if (phase !== 'waiting') return;
    // The pending target goes with it: a false start that leaves its timeout
    // running shows the target in the middle of the next round's wait.
    timers.clear();
    setLast(null);
    setPhase('early');
    timers.after(EARLY_MS, () => {
      setRound((was) => was + 1);
    });
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative h-44 w-full max-w-[320px]">
        <button
          type="button"
          onClick={early}
          aria-label={t('reaction.fieldLabel')}
          className="size-full rounded-md border border-line bg-bg-grain outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
        {phase === 'target' ? (
          <button
            type="button"
            onClick={hit}
            aria-label={t('reaction.hitTarget')}
            className="absolute size-9 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-accent bg-accent-soft outline-none focus-visible:ring-2 focus-visible:ring-accent"
            style={{ left: `${String(spot.x)}%`, top: `${String(spot.y)}%` }}
          />
        ) : null}
        <p
          className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-sm text-muted"
          aria-live="polite"
        >
          {phase === 'waiting'
            ? t('reaction.wait')
            : phase === 'early'
              ? t('reaction.tooEarly')
              : ''}
        </p>
      </div>

      {/* The time is said once, here: announced in the field and again below it
          is a screen reader repeating itself on every round. */}
      <div className="flex items-center gap-2" aria-live="polite">
        {last === null ? null : <Badge tone={toneFor(last)}>{t('reaction.time', { ms: last })}</Badge>}
        {best === null ? null : (
          <span className="font-mono text-xs tabular-nums text-muted">
            {t('reaction.best', { ms: best })}
          </span>
        )}
      </div>

      <PlayAgain onClick={again} />
    </div>
  );
}
