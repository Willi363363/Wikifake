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

import { asClock } from './clock.js';

export interface BriefProps {
  readonly open: boolean;
  /** How many paragraphs were altered. C1.1 — never which ones. */
  readonly total: number;
  readonly timeLimit: number;
  onOpenChange(open: boolean): void;
}

export function Brief({ open, total, timeLimit, onOpenChange }: BriefProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined}>
        <DialogTitle>The brief</DialogTitle>
        <DialogDescription>
          {total === 1
            ? 'One paragraph of this article states something false.'
            : `${String(total)} paragraphs of this article state something false.`}{' '}
          Mark every one you find, then submit. You have {asClock(timeLimit)}.
        </DialogDescription>

        <dl className="mt-5 space-y-2 text-sm">
          <Line
            label="A falsification you find"
            value={`+${String(PER_TRUE_POSITIVE)}`}
          />
          <Line
            label="A paragraph marked for nothing"
            value={`−${String(PER_FALSE_POSITIVE)}`}
          />
          <Line label="A hint" value={`−${String(HINT_COST)}`} />
          <Line label="Finishing early" value="a bonus on the time left" />
        </dl>

        <p className="mt-5 text-xs text-muted">
          Nothing on this screen knows which paragraphs were altered. The server grades,
          and the answer arrives when the round ends.
        </p>
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
