'use client';

// The intel room: one card per falsification, and what it costs to be told.
//
// The cards are **numbers**, never positions. The player knows how many
// paragraphs were altered and buys against a number; which paragraph it is comes
// back only with the reveal, and only after it has been billed (C1.4).
//
// A real dialog, from step 6.2, and one of them rather than two: the current
// game puts a second full-screen modal over this one when hints are jammed,
// which is a focus trap fighting a focus trap. Jammed is a state of this panel.
import { HINT_COST, REVEAL_COST } from '@wikifake/domain';
import {
  Badge,
  Button,
  cn,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@wikifake/ui';

import type { HintsState } from './hints.js';

/** What an unbought card shows. Blocks, so nothing can be read into a length. */
const REDACTED = '▒▒▒▒▒ ▒▒▒▒▒▒ ▒▒▒ ▒▒▒▒';

export interface IntelProps {
  readonly open: boolean;
  /** How many falsifications there are. C1.1 — the count, never which ones. */
  readonly total: number;
  readonly hints: HintsState;
  /** True once the round is out of the player's hands. */
  readonly locked: boolean;
  onOpenChange(open: boolean): void;
  onUnlock(falseInfoNumber: number, level: 1 | 2): void;
}

export function Intel({
  open,
  total,
  hints,
  locked,
  onOpenChange,
  onUnlock,
}: IntelProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) hints.clearBlocked();
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogTitle>Intel</DialogTitle>
        <DialogDescription>
          Buy a nudge, or the answer. Both are charged by the server, once.
        </DialogDescription>

        <p className="mt-3 flex flex-wrap items-center gap-2">
          <Badge tone="bronze">hint −{String(HINT_COST)}</Badge>
          <Badge tone="danger">reveal −{String(REVEAL_COST)}</Badge>
          {hints.penalty > 0 ? (
            <span className="font-mono text-xs tabular-nums text-muted">
              spent {String(hints.penalty)}
            </span>
          ) : null}
        </p>

        {/* C1.5 — a rival's HINT_LOCK. Said here rather than in a modal over a
            modal: the panel opens, and it is jammed. */}
        {hints.blocked ? (
          <p
            role="alert"
            className="mt-4 rounded-lg border border-danger/25 bg-danger-soft px-4 py-3 text-sm text-danger"
          >
            Another player has jammed your intel. Nothing was charged — try again in a
            moment.
          </p>
        ) : null}

        <ul className="mt-4 grid max-h-[50vh] grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2">
          {Array.from({ length: total }, (_, at) => at + 1).map((number) => {
            const held = hints.held[number];
            const level = held?.level ?? 0;

            return (
              <li
                key={number}
                className={cn(
                  'flex flex-col gap-2 rounded-lg border p-3',
                  level > 0
                    ? 'border-bronze/25 bg-bronze-soft'
                    : 'border-line bg-bg-grain',
                )}
              >
                <p className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[10px] tracking-[0.12em] text-muted uppercase">
                    target {String(number).padStart(2, '0')}
                  </span>
                  {level === 0 ? null : (
                    <Badge tone={level === 2 ? 'danger' : 'bronze'}>
                      level {String(level)}
                    </Badge>
                  )}
                </p>

                <p
                  className={cn(
                    'flex-1 text-[13px] leading-snug',
                    level === 0
                      ? 'font-mono tracking-[0.06em] text-muted-2 select-none'
                      : 'text-ink-2',
                  )}
                >
                  {level === 0 ? (
                    <span aria-label="not bought">{REDACTED}</span>
                  ) : (
                    (held?.truth ?? held?.hint)
                  )}
                </p>

                <p className="flex gap-2">
                  <Button
                    variant="ghost"
                    className="flex-1"
                    disabled={locked || level >= 1}
                    onClick={() => {
                      onUnlock(number, 1);
                    }}
                    aria-label={`Buy a hint on target ${String(number)}`}
                  >
                    Hint
                  </Button>
                  <Button
                    variant="ghost"
                    className="flex-1"
                    disabled={locked || level >= 2}
                    onClick={() => {
                      onUnlock(number, 2);
                    }}
                    aria-label={`Reveal target ${String(number)}`}
                  >
                    Reveal
                  </Button>
                </p>
              </li>
            );
          })}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
