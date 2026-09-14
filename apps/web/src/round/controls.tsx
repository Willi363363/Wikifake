'use client';

// The round's controls: how long is left, how much is marked, and the way out.
//
// **R3 — a rail beside the article on a wide screen, a bar on a phone**, which
// is the arrangement the owner chose. It was a sticky header across the top, and
// that put the clock and the submit button above an article the player is
// scrolling *past* them: on a laptop the whole right-hand margin sat empty while
// the two things being looked for were the two furthest from the eye.
//
// **One element, two shapes.** It is not a rail and a bar rendered together with
// one of them hidden — that is two clocks and two submit buttons in the
// document, which is two things a screen reader reads and one of them a lie. It
// is `fixed` to the bottom edge below `lg` and a sticky column of the grid at
// `lg` and up, and everything between those is the same node with the same
// handlers.
//
// The few parts a phone has no room for are the ones that say nothing it does
// not already know: the topic is the article's own heading, and the altered
// count is repeated in the brief. Those are hidden by width. The clock, the
// count marked, the brief, the intel and the submit are on both.
//
// What it does not carry: a logo that navigates on click without saying so, a
// hard-coded "Intelligence System · v2.0.1", and a mode chip for an expert mode
// the new protocol has no field for. Ported means the parts that do something.
import { Badge, Button, cn } from '@wikifake/ui';
import { useTranslations } from 'next-intl';

import { asClock, pressureAt, type Pressure } from './clock.js';

/**
 * How urgency reads.
 *
 * It used to be a text colour per level, and after the brutalist palette that
 * meant the clock grew *less* legible as the pressure rose: `warn` on `surface`
 * measures 1.83 and `danger` 3.03, against 21.00 for the calm state. A timer
 * that fades as it runs out is the exact opposite of what it is for.
 *
 * A level is a fill now, carrying `on-fill` — 11.48 and 6.94, both measured —
 * and a slab of colour reads across a room in a way a coloured numeral does
 * not. `calm` stays plain text: not every state needs to shout, and a clock
 * that is always a chip has nothing left to escalate to.
 */
const TONE: Readonly<Record<Pressure, string>> = {
  calm: 'text-ink',
  warning: 'rounded-lg bg-warn px-2 text-on-fill',
  urgent: 'rounded-lg bg-danger px-2 text-on-fill',
};

export interface RoundControlsProps {
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

export function RoundControls({
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
}: RoundControlsProps) {
  const t = useTranslations('round');
  const pressure = pressureAt(secondsLeft);

  return (
    <aside
      aria-label={t('topBar.aria')}
      className={cn(
        // The phone shape: a bar across the bottom edge, over the page — which
        // is the one thing `shadow-lg` is for. `fixed` takes it out of the
        // flow, so the grid it is declared inside is a single column there.
        'fixed inset-x-0 bottom-0 z-30 flex flex-wrap items-center gap-x-4 gap-y-2',
        'bg-surface px-4 py-3 shadow-lg',
        // The wide shape: the second column of the grid, stuck near the top of
        // it, scrolling with nothing. No shadow — it is in the page here, not
        // over it.
        'lg:sticky lg:top-6 lg:z-auto lg:flex-col lg:items-stretch lg:gap-4',
        'lg:self-start lg:rounded-xl lg:p-5 lg:shadow-none',
      )}
    >
      {/* The article's own heading says this on a phone, so it is the one line
          the narrow shape drops rather than shrinks. */}
      <p className="hidden text-lg text-ink lg:block">{topic}</p>

      <p
        role="timer"
        aria-label={t('topBar.timeLeft')}
        className={cn(
          'font-mono tabular-nums',
          // Large on the rail, because the margin is there and a clock is the
          // thing a player looks up for. On the bar it sits in a row with four
          // other controls and cannot be.
          'text-lg lg:text-4xl lg:leading-none',
          TONE[pressure],
        )}
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

      <p className="flex items-baseline gap-1.5">
        <span className="font-mono text-[10px] tracking-[0.12em] text-muted uppercase">
          {t('topBar.markedLabel')}
        </span>
        <span className="font-mono text-sm tabular-nums text-ink">
          {String(marked)}
          <span className="text-muted">/{String(total)}</span>
        </span>
      </p>

      {/* C1.1 — the count of altered paragraphs, never which ones. Hidden on a
          phone because the brief says it too, and a bar with six things on it
          is a bar with nothing on it. */}
      <span className="hidden lg:inline-flex">
        <Badge tone="accent">{t('topBar.alteredCount', { total })}</Badge>
      </span>

      {/* `ml-auto` on the bar only: it pushes the actions to the right-hand
          end of a row, and a column has no right-hand end. */}
      <span className="ml-auto flex items-center gap-2 lg:ml-0 lg:flex-col lg:items-stretch">
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

        <span className="flex items-center gap-2">
          <Button variant="ghost" onClick={onOpenBrief} className="lg:flex-1">
            {t('topBar.brief')}
          </Button>

          {/* C1.5 — a jam is said on the button, not by opening the panel over
              the article. A modal a rival can make appear on your screen while
              you are reading is a modal that steals your focus on their
              command; the current game does exactly that. The panel says what
              happened when the player chooses to look, which in the ordinary
              sequence — open, buy, refused — it already is. */}
          <Button
            variant={hintsJammed ? 'danger' : 'ghost'}
            onClick={onOpenIntel}
            aria-label={hintsJammed ? t('topBar.intelJammed') : undefined}
            className="lg:flex-1"
          >
            {t('topBar.intel')}
            {hintsUsed === 0 ? null : (
              // The count is in the label rather than in a floating badge: a
              // badge positioned over the corner of a button is a number a
              // screen reader reads out of order, or not at all.
              <span className="rounded-sm bg-bronze px-1 font-mono text-[10px] tabular-nums text-on-fill">
                {String(hintsUsed)}
              </span>
            )}
          </Button>
        </span>
      </span>
    </aside>
  );
}
