'use client';

// The round's header: what is being played, how long is left, and the way out.
//
// Sticky, because the submit button and the clock are the two things a player
// looks for while scrolling an article. The current one is a seven-column grid
// that collapses into a heap below about 900 pixels; this wraps.
//
// What it does not carry: a logo that navigates on click without saying so, a
// hard-coded "Intelligence System · v2.0.1", and a mode chip for an expert mode
// the new protocol has no field for. Ported means the parts that do something.
import { Badge, Button, cn } from '@wikifake/ui';

import { asClock, pressureAt, type Pressure } from './clock.js';

/** How urgency reads, in the theme's colours. */
const TONE: Readonly<Record<Pressure, string>> = {
  calm: 'text-ink',
  warning: 'text-warn',
  urgent: 'text-danger',
};

export interface RoundTopBarProps {
  readonly topic: string;
  readonly secondsLeft: number;
  readonly marked: number;
  /** How many paragraphs were altered. C1.1 — the count, never which ones. */
  readonly total: number;
  /** True once the answer is with the server. */
  readonly submitted: boolean;
  /** True while a request is in flight. */
  readonly busy: boolean;
  onSubmit(): void;
  /** Absent where taking a submission back is not possible — solo, over REST. */
  readonly onUnsubmit?: (() => void) | undefined;
  onOpenBrief(): void;
}

export function RoundTopBar({
  topic,
  secondsLeft,
  marked,
  total,
  submitted,
  busy,
  onSubmit,
  onUnsubmit,
  onOpenBrief,
}: RoundTopBarProps) {
  const pressure = pressureAt(secondsLeft);

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-glass-strong backdrop-blur-md">
      <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
        <p className="text-lg text-ink">{topic}</p>

        <Badge tone="accent">{String(total)} altered</Badge>

        <span className="flex-1" />

        <Button variant="ghost" onClick={onOpenBrief}>
          Brief
        </Button>

        <p className="flex items-baseline gap-1.5">
          <span className="font-mono text-[10px] tracking-[0.12em] text-muted uppercase">
            marked
          </span>
          <span className="font-mono text-sm tabular-nums text-ink">
            {String(marked)}
            <span className="text-muted">/{String(total)}</span>
          </span>
        </p>

        <p
          role="timer"
          aria-label="Time left"
          className={cn('font-mono text-lg tabular-nums', TONE[pressure])}
        >
          {asClock(secondsLeft)}
          {/* The colour is not the message. A player who cannot see it is told
              in words, once per state rather than once per second. */}
          <span className="sr-only">
            {pressure === 'urgent'
              ? ' — almost out of time'
              : pressure === 'warning'
                ? ' — time is running short'
                : ''}
          </span>
        </p>

        {submitted && onUnsubmit !== undefined ? (
          <Button variant="danger" onClick={onUnsubmit} disabled={busy}>
            Take it back
          </Button>
        ) : (
          <Button variant="primary" onClick={onSubmit} disabled={busy || submitted}>
            {busy ? 'Sending…' : submitted ? 'Submitted' : 'Submit'}
          </Button>
        )}
      </div>
    </header>
  );
}
