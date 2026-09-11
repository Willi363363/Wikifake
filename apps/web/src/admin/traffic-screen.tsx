// Arrivals — step J.4b.
//
// The headline is the **ratio**, not the totals: a landing that doubles its
// arrivals and keeps its reach did well, and one that doubles them and halves
// its reach found the wrong audience. The two counts are underneath, because
// the ratio without them is a percentage of an unknown.
//
// Two things are said out loud rather than left to be inferred, and both are
// the kind a dashboard is normally silent about: **these are loads, not
// people**, and **counting started on a day**. A reader comparing this quarter
// with last would otherwise be comparing a measurement with its own absence.
import { useFormatter, useTranslations } from 'next-intl';

import type { TrafficView } from './traffic.js';

export interface TrafficSectionProps {
  readonly traffic: TrafficView;
}

/**
 * The days shown, most recent first.
 *
 * Fourteen: a fortnight is what somebody who posted a link on Monday is looking
 * for, and ninety rows of a two-column table is a wall nobody reads. The rest
 * are counted in a line underneath rather than dropped silently.
 */
const SHOWN = 14;

export function TrafficSection({ traffic }: TrafficSectionProps) {
  const t = useTranslations('admin.traffic');
  const format = useFormatter();
  const n = (value: number) => format.number(value);

  const days = traffic.days.slice(0, SHOWN);
  const hidden = traffic.days.length - days.length;

  return (
    <section aria-labelledby="admin-traffic" className="mt-8">
      <h2
        id="admin-traffic"
        className="font-mono text-xs tracking-[0.12em] text-muted uppercase"
      >
        {t('title')}
      </h2>

      <div className="mt-3 border-3 border-line-strong bg-surface px-3 py-3 shadow-md">
        <p className="font-mono text-[10px] tracking-[0.12em] text-muted uppercase">
          {t('reach')}
        </p>
        <p className="mt-1 font-mono text-3xl tabular-nums text-ink">
          {traffic.reach === null
            ? t('none')
            : format.number(traffic.reach, {
                style: 'percent',
                maximumFractionDigits: 1,
              })}
        </p>
        <p className="mt-1 text-xs text-muted">{t('reachWhy')}</p>
        <p className="mt-2 font-mono text-sm tabular-nums text-ink">
          {t('landing')} {n(traffic.landing)} · {t('entry')} {n(traffic.entry)}
        </p>
      </div>

      {traffic.days.length === 0 ? (
        <p className="mt-3 max-w-prose text-xs text-muted">{t('empty')}</p>
      ) : (
        <div className="mt-3 overflow-x-auto border-3 border-line-strong bg-surface shadow-md">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-3 border-line-strong">
                <th scope="col" className="px-3 py-2 text-left text-muted">
                  {t('columns.day')}
                </th>
                <th scope="col" className="px-3 py-2 text-right text-muted">
                  {t('columns.landing')}
                </th>
                <th scope="col" className="px-3 py-2 text-right text-muted">
                  {t('columns.entry')}
                </th>
              </tr>
            </thead>
            <tbody>
              {days.map((day) => (
                <tr key={day.day}>
                  {/* The stored `YYYY-MM-DD`, not a formatted date: the column
                      is a UTC day and a locale format would render it in the
                      reader's zone, moving a figure to the day before. */}
                  <td className="px-3 py-2 font-mono tabular-nums text-ink">{day.day}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums text-ink">
                    {n(day.landing)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums text-muted">
                    {n(day.entry)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {hidden > 0 && (
        <p className="mt-2 text-xs text-muted">{t('more', { count: hidden })}</p>
      )}

      <p className="mt-3 max-w-prose text-xs text-muted">
        {traffic.since === null ? t('never') : t('since', { day: traffic.since })}
      </p>
      <p className="mt-2 max-w-prose text-xs text-muted">{t('caveat')}</p>
    </section>
  );
}
