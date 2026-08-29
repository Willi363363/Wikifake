'use client';

// The brief: what the player is being asked to do, and what it is worth.
//
// A real dialog, from step 6.2. The current one is a fixed `<div>` over an
// overlay `<div>`: nothing traps focus, so tab walks into the page behind it,
// Escape does nothing, and a screen reader is told nothing has happened.
//
// The numbers come from `@wikifake/domain`. They are the scoring rules of step
// 1.4, and the current game states them in `frontend/src/config.js` as well as
// in `backend/src/scoring.py` — a screen that quotes the scale from a copy is a
// screen that will one day quote a scale nobody uses.
import { HINT_COST, PER_FALSE_POSITIVE, PER_TRUE_POSITIVE } from '@wikifake/domain';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@wikifake/ui';
import { useTranslations } from 'next-intl';

import { asClock } from './clock.js';

export interface BriefProps {
  readonly open: boolean;
  /** How many paragraphs were altered. C1.1 — never which ones. */
  readonly total: number;
  readonly timeLimit: number;
  onOpenChange(open: boolean): void;
}

export function Brief({ open, total, timeLimit, onOpenChange }: BriefProps) {
  const t = useTranslations('round');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined}>
        <DialogTitle>{t('brief.title')}</DialogTitle>
        <DialogDescription>
          {/* One whole message: the plural is ICU's, not a ternary gluing
              fragments, and the clock rides along as a placeholder. */}
          {t('brief.description', { total, time: asClock(timeLimit) })}
        </DialogDescription>

        <dl className="mt-5 space-y-2 text-sm">
          <Line
            label={t('brief.scoring.truePositive')}
            value={`+${String(PER_TRUE_POSITIVE)}`}
          />
          <Line
            label={t('brief.scoring.falsePositive')}
            value={`−${String(PER_FALSE_POSITIVE)}`}
          />
          <Line label={t('brief.scoring.hint')} value={`−${String(HINT_COST)}`} />
          <Line
            label={t('brief.scoring.earlyFinish')}
            value={t('brief.scoring.earlyFinishValue')}
          />
        </dl>

        <p className="mt-5 text-xs text-muted">{t('brief.serverGradesNote')}</p>
      </DialogContent>
    </Dialog>
  );
}

function Line({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className="font-mono tabular-nums text-ink">{value}</dd>
    </div>
  );
}
