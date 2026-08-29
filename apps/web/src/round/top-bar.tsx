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
import { useTranslations } from 'next-intl';

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
  /** How many falsifications a hint has been bought on. */
  readonly hintsUsed: number;
  /** C1.5 — a rival's `HINT_LOCK` refused the last request. */
  readonly hintsJammed: boolean;
  onSubmit(): void;
  /** Absent where taking a submission back is not possible — solo, over REST. */
  readonly onUnsubmit?: (() => void) | undefined;
  onOpenBrief(): void;
  onOpenIntel(): void;
}

export function RoundTopBar({
  topic,
  secondsLeft,
  marked,
  total,
  submitted,
  busy,
  hintsUsed,
  hintsJammed,
  onSubmit,
  onUnsubmit,
  onOpenBrief,
  onOpenIntel,
}: RoundTopBarProps) {
  const t = useTranslations('round');
  const pressure = pressureAt(secondsLeft);

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-glass-strong backdrop-blur-md">
      <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
        <p className="text-lg text-ink">{topic}</p>

        <Badge tone="accent">{t('topBar.alteredCount', { total })}</Badge>

        <span className="flex-1" />

        <Button variant="ghost" onClick={onOpenBrief}>
          {t('topBar.brief')}
        </Button>

        {/* C1.5 — a jam is said on the button, not by opening the panel over the
            article. A modal a rival can make appear on your screen while you are
            reading is a modal that steals your focus on their command; the
            current game does exactly that. The panel says what happened when the
            player chooses to look, which in the ordinary sequence — open, buy,
            refused — it already is. */}
        <Button
          variant={hintsJammed ? 'danger' : 'ghost'}
          onClick={onOpenIntel}
          aria-label={hintsJammed ? t('topBar.intelJammed') : undefined}
        >
          {t('topBar.intel')}
          {hintsUsed === 0 ? null : (
            // The count is in the label rather than in a floating badge: a badge
            // positioned over the corner of a button is a number a screen reader
            // reads out of order, or not at all.
            <span className="font-mono text-[10px] tabular-nums text-bronze">
              {String(hintsUsed)}
            </span>
          )}
        </Button>

        <p className="flex items-baseline gap-1.5">
          <span className="font-mono text-[10px] tracking-[0.12em] text-muted uppercase">
            {t('topBar.markedLabel')}
          </span>
          <span className="font-mono text-sm tabular-nums text-ink">
            {String(marked)}
            <span className="text-muted">/{String(total)}</span>
          </span>
        </p>

        <p
          role="timer"
          aria-label={t('topBar.timeLeft')}
          className={cn('font-mono text-lg tabular-nums', TONE[pressure])}
        >
          {asClock(secondsLeft)}
          {/* The colour is not the message. A player who cannot see it is told
              in words, once per state rather than once per second. */}
          <span className="sr-only">
            {/* Whole messages; the dash is layout, joined here rather than
                baked into a fragment a translator would have to keep. */}
            {pressure === 'calm' ? '' : ` — ${t(`topBar.pressure.${pressure}`)}`}
          </span>
        </p>

        {submitted && onUnsubmit !== undefined ? (
          <Button variant="danger" onClick={onUnsubmit} disabled={busy}>
            {t('topBar.unsubmit')}
          </Button>
        ) : (
          <Button variant="primary" onClick={onSubmit} disabled={busy || submitted}>
            {busy
              ? t('topBar.submitting')
              : submitted
                ? t('topBar.submitted')
                : t('topBar.submit')}
          </Button>
        )}
      </div>
    </header>
  );
}
