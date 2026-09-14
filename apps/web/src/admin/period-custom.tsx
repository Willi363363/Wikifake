'use client';

// The custom period — step K.2.
//
// The lab drew this as a mockup: two dates written into the markup and an
// Apply that selected one hard-coded range. This is the real one, and the
// track said K.2 either builds it or cuts it.
//
// **A `GET` form, so the browser does the navigating.** Two date inputs and a
// hidden `range=custom` submit to the page they are on, which produces exactly
// the address a preset link would — bookmarkable, shareable, and reloadable.
// Nothing here calls a router, and nothing needs a server action: a period is
// a query string, and a form is how HTML has always written one.
//
// **The dates are native inputs rather than a calendar of our own.** A hand
// rolled month grid is a date picker that works in one language, ignores the
// platform's own keyboard affordances, and is dead without JavaScript. `<input
// type="date">` is the reader's calendar, in the reader's language, and it
// submits `YYYY-MM-DD` — which is the spelling `rangeFrom` already reads.
import { useTranslations } from 'next-intl';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

const FIELD =
  'flex min-h-11 w-full items-center border-3 border-line-strong bg-surface px-3 font-mono text-sm text-ink shadow-sm';
const LABEL = 'font-mono text-[10px] tracking-[0.12em] text-muted uppercase';
const BUTTON = 'min-h-11 border-3 border-line-strong px-4 text-sm';

/** Whole days between two `YYYY-MM-DD`, both ends counted. */
function daysBetween(from: string, to: string): number {
  const span = Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`);
  return Number.isNaN(span) ? 0 : Math.floor(span / 86_400_000) + 1;
}

function CalendarIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="square"
      aria-hidden
    >
      <path d="M3.5 5h17v16h-17zM3.5 10h17M8 3v4M16 3v4" />
    </svg>
  );
}

export interface CustomPeriodProps {
  readonly chosen: boolean;
  /** The days the range in the address covers — what the dialog opens on. */
  readonly from: string;
  readonly to: string;
  /** Today, in the same spelling. Nothing later can be asked for. */
  readonly today: string;
  readonly className: string;
}

export function CustomPeriod({ chosen, from, to, today, className }: CustomPeriodProps) {
  const t = useTranslations('admin.range.custom');
  // The browser's own path, prefix included: `next-intl`'s `usePathname` strips
  // the locale, and a form action has to be the address as it actually is.
  const action = usePathname();
  const [open, setOpen] = useState(false);
  const [start, setStart] = useState(from);
  const [end, setEnd] = useState(to);

  const backwards = start > end;

  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => {
          setStart(from);
          setEnd(to);
          setOpen(true);
        }}
        className={`${className} gap-2`}
      >
        <CalendarIcon />
        {chosen ? `${from} → ${to}` : t('open')}
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4">
          <form
            method="get"
            action={action}
            role="dialog"
            aria-modal="true"
            aria-label={t('title')}
            className="flex w-full max-w-lg flex-col border-3 border-line-strong bg-surface shadow-lg"
          >
            <input type="hidden" name="range" value="custom" />

            <div className="flex items-start justify-between gap-4 border-b-3 border-line-strong p-4">
              <div className="flex flex-col gap-1">
                <h2 className="m-0 text-lg font-extrabold text-ink">{t('title')}</h2>
                <p className="m-0 text-xs text-muted">{t('lead')}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                }}
                aria-label={t('close')}
                className="flex size-11 shrink-0 items-center justify-center border-3 border-line-strong bg-surface text-ink"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.6}
                  strokeLinecap="square"
                  aria-hidden
                >
                  <path d="M5 5l14 14M19 5L5 19" />
                </svg>
              </button>
            </div>

            <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-end">
              <label className="flex min-w-0 flex-1 flex-col gap-1.5">
                <span className={LABEL}>{t('from')}</span>
                <input
                  type="date"
                  name="from"
                  value={start}
                  max={today}
                  required
                  onChange={(event) => {
                    setStart(event.target.value);
                  }}
                  className={FIELD}
                />
              </label>
              <span className="hidden pb-3 font-mono text-sm text-muted sm:inline">
                →
              </span>
              <label className="flex min-w-0 flex-1 flex-col gap-1.5">
                <span className={LABEL}>{t('to')}</span>
                <input
                  type="date"
                  name="to"
                  value={end}
                  max={today}
                  required
                  onChange={(event) => {
                    setEnd(event.target.value);
                  }}
                  className={FIELD}
                />
              </label>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 border-t-3 border-line-strong bg-bg p-4">
              <span className="font-mono text-xs text-muted">
                {backwards
                  ? t('backwards')
                  : t('days', { count: daysBetween(start, end) })}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                  }}
                  className={`${BUTTON} bg-surface font-medium text-ink`}
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  disabled={backwards}
                  className={`${BUTTON} bg-accent font-bold text-on-fill shadow-sm disabled:pointer-events-none disabled:bg-bg-grain disabled:text-muted disabled:shadow-none`}
                >
                  {t('apply')}
                </button>
              </div>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}
