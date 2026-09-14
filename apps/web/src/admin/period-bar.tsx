'use client';

// The period, above every page — step K.2.
//
// It sits in the panel's own chassis rather than inside a page, because it
// belongs to all of them: one selector, one address, and every figure below it
// answers for the same window. The alternative — a control per page — is how
// two screens come to disagree about what "this month" meant.
//
// **Links, not buttons**, which is what I.8 decided and K.2 keeps: each preset
// is a different panel at a different address, so it is bookmarkable, shareable
// and survives the reload somebody does when a figure surprises them. A browser
// running no JavaScript at all gets every preset. `aria-current` announces the
// chosen one, because an underline is visible and not audible.
//
// **It does not move everything, and that is the honest part.** A live probe
// has no history, a cumulative total has no date, and `activeToday` is a fixed
// window whatever the period says. The bar says so once, here, so no page has
// to say it twice.
import { useFormatter, useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';

import { Link, usePathname } from '../i18n/navigation.js';
import { CustomPeriod } from './period-custom.js';
import { dayOf, rangeFrom, PRESETS, type Range } from './range.js';

const CHIP =
  'flex min-h-11 items-center border-3 border-line-strong px-3 py-2 text-[13px] whitespace-nowrap';
const ON = `${CHIP} bg-accent font-bold text-on-fill shadow-sm`;
const OFF = `${CHIP} bg-surface font-medium text-ink`;

export interface PeriodBarProps {
  /**
   * Now, from the server.
   *
   * Passed in rather than read here so the bar renders the same window on the
   * server and on the client. A `Date.now()` in a client component is two
   * different instants either side of hydration, and a period whose dates
   * changed as the page came alive would be a period nobody could trust.
   */
  readonly nowMs: number;
}

export function PeriodBar({ nowMs }: PeriodBarProps) {
  const t = useTranslations('admin.range');
  const format = useFormatter();
  // The path the period comes back to. K.1 split the panel into eight routes,
  // and a hardcoded `/admin` would send anybody changing the period on a
  // section back to the way in.
  const here = usePathname();
  const asked = useSearchParams();

  // One implementation of what a query string means, shared with the pages
  // below: the bar naming a window the figures were not read for is the one
  // failure a period selector cannot recover from.
  const range: Range = rangeFrom(asked.get('range') ?? undefined, nowMs, {
    from: asked.get('from') ?? undefined,
    to: asked.get('to') ?? undefined,
  });

  return (
    <div className="flex flex-col gap-2 border-b-3 border-line-strong bg-surface px-4 py-3 sm:px-6">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[10px] tracking-[0.14em] text-muted uppercase">
          {t('label')}
        </span>

        {PRESETS.map((preset: (typeof PRESETS)[number]) => (
          <Link
            key={preset}
            href={`${here}?range=${preset}`}
            aria-current={preset === range.preset ? 'page' : undefined}
            // A chosen chip is a fill carrying `on-fill`; the rest are washes
            // carrying `ink`. Never a fill used as a text colour.
            className={preset === range.preset ? ON : OFF}
          >
            {t(`presets.${preset}`)}
          </Link>
        ))}

        <CustomPeriod
          chosen={range.preset === 'custom'}
          from={dayOf(range.fromMs)}
          to={dayOf(range.toMs - 1)}
          today={dayOf(nowMs)}
          className={range.preset === 'custom' ? ON : OFF}
        />
      </div>

      <p className="m-0 max-w-prose text-xs text-muted">
        {range.preset === 'all'
          ? t('coveringAll')
          : t('covering', {
              from: format.dateTime(new Date(range.fromMs), { dateStyle: 'medium' }),
              // The last day that is *in* the range, not the midnight after it.
              to: format.dateTime(new Date(range.toMs - 1), { dateStyle: 'medium' }),
            })}{' '}
        {t('whatItMoves')}
      </p>
    </div>
  );
}
