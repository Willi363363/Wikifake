// Arrivals — step K.6, the digest and the one-step funnel.
//
// The owner chose the digest **and** the shape beside it: tiles, then landing →
// entry drawn as the single step this page actually measures, then the paired
// chart and the rows. Two candidates became one page because they answered
// different halves of the same question — how many, and how many were lost.
//
// The headline is still the **ratio** and not the totals, which is J.4b's
// decision and survives the new shape: a landing that doubles its arrivals and
// keeps its reach did well, and one that doubles them and halves its reach
// found the wrong audience.
//
// Two things are said out loud rather than left to be inferred, and both are
// the kind a dashboard is normally silent about: **these are loads, not
// people**, and **counting started on a day**. A reader comparing this quarter
// with last would otherwise be comparing a measurement with its own absence.
import { useTranslations } from 'next-intl';

import { CARD, Count, Key, LABEL, PairedBars, Percent, Tile } from './parts.js';
import type { TrafficView } from './traffic.js';

export interface TrafficSectionProps {
  readonly traffic: TrafficView;
}

/**
 * The days listed, most recent first.
 *
 * Fourteen: a fortnight is what somebody who posted a link on Monday is looking
 * for, and ninety rows of a three-column table is a wall nobody reads. The rest
 * are counted in a line underneath rather than dropped silently — and the chart
 * beside the table draws every day the period has.
 */
const SHOWN = 14;

/** The one step this page is: everything that arrived, and what reached entry. */
function OneStep({ traffic }: TrafficSectionProps) {
  const t = useTranslations('admin.traffic');
  const lost = Math.max(0, traffic.landing - traffic.entry);
  // Reach can pass 100 % — the entry screen is reachable from a bookmark — so
  // the bar is clamped and the figure beside it is not. A bar wider than its
  // own container would say the opposite of what the number says.
  const width = Math.min(100, (traffic.reach ?? 0) * 100);

  return (
    <section className={`${CARD} flex flex-col gap-4 p-5`}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h2 className="m-0 text-lg font-bold text-ink">{t('oneStep')}</h2>
        <span className="font-mono text-[11px] text-muted">{t('oneStepWhy')}</span>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-full items-center rounded-lg bg-accent-line px-4">
            <span className="truncate text-sm font-bold text-ink">{t('landing')}</span>
          </div>
          <span className="w-20 shrink-0 text-right font-mono text-xl font-bold tabular-nums text-ink">
            <Count value={traffic.landing} />
          </span>
        </div>

        <p className="m-0 py-0.5 pl-4 text-[12.5px] text-muted">
          {t('lost', { count: lost })}
        </p>

        <div className="flex items-center gap-4">
          <div
            className="flex h-12 items-center rounded-lg bg-accent px-4"
            style={{ width: `max(9rem, ${String(width)}%)` }}
          >
            <span className="truncate text-sm font-bold text-ink">{t('entry')}</span>
          </div>
          <span className="ml-auto w-20 shrink-0 text-right font-mono text-xl font-bold tabular-nums text-ink">
            <Count value={traffic.entry} />
          </span>
        </div>
      </div>
    </section>
  );
}

export function TrafficSection({ traffic }: TrafficSectionProps) {
  const t = useTranslations('admin.traffic');

  const days = traffic.days.slice(0, SHOWN);
  const hidden = traffic.days.length - days.length;
  // Oldest first: a chart is read left to right, and `readTraffic` answers most
  // recent first because a table is read from today backwards.
  const chart = [...traffic.days].reverse();

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tile
          label={t('landing')}
          value={<Count value={traffic.landing} />}
          note={t('pageLoads')}
        />
        <Tile
          label={t('entry')}
          value={<Count value={traffic.entry} />}
          note={t('pageLoads')}
        />
        <Tile
          label={t('reach')}
          value={<Percent share={traffic.reach} nothing={t('none')} />}
          note={t('reachShort')}
          filled
        />
        {/* The stored `YYYY-MM-DD`, not a formatted date: the column is a UTC
            day and a locale format would render it in the reader's zone,
            moving the first counted day to the one before. */}
        <Tile
          label={t('countingSince')}
          value={traffic.since ?? t('none')}
          note={t('nothingBefore')}
        />
      </div>

      <OneStep traffic={traffic} />

      {traffic.days.length === 0 ? (
        <p className="m-0 max-w-prose text-sm text-ink-2">{t('empty')}</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
          <section className={`${CARD} flex flex-col gap-4 p-5`}>
            <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
              <h2 className="m-0 text-lg font-bold text-ink">{t('dayByDay')}</h2>
              <div className="flex gap-4">
                <Key fill="bg-accent-line" label={t('landing')} />
                <Key fill="bg-accent" label={t('entry')} />
              </div>
            </div>
            {/* Paired rather than stacked: landing and entry are not parts of a
                whole, which is the same fact that lets reach pass 100 %. */}
            <PairedBars
              first={chart.map((day) => ({ label: day.day, value: day.landing }))}
              second={chart.map((day) => ({ label: day.day, value: day.entry }))}
            />
          </section>

          <section className={`${CARD} flex flex-col gap-3 p-5`}>
            <h2 className="m-0 text-lg font-bold text-ink">{t('rows')}</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line-strong">
                    <th scope="col" className={`${LABEL} px-2 py-2 text-left`}>
                      {t('columns.day')}
                    </th>
                    <th scope="col" className={`${LABEL} px-2 py-2 text-right`}>
                      {t('columns.landing')}
                    </th>
                    <th scope="col" className={`${LABEL} px-2 py-2 text-right`}>
                      {t('columns.entry')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {days.map((day) => (
                    <tr key={day.day} className="border-b-1 border-line last:border-b-0">
                      <td className="px-2 py-2 font-mono text-[12.5px] tabular-nums text-ink">
                        {day.day}
                      </td>
                      <td className="px-2 py-2 text-right font-mono text-[13px] font-bold tabular-nums text-ink">
                        <Count value={day.landing} />
                      </td>
                      <td className="px-2 py-2 text-right font-mono text-[13px] tabular-nums text-muted">
                        <Count value={day.entry} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {hidden > 0 ? (
              <p className="m-0 text-xs text-muted">{t('more', { count: hidden })}</p>
            ) : null}
          </section>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <p className="m-0 max-w-prose text-[11.5px] leading-relaxed text-muted">
          {/* The stored day and not a formatted date, for the tile's reason:
              the column is a UTC day, and rendering it in the reader's zone
              would name the day before as the first one counted. */}
          {traffic.since === null ? t('never') : t('since', { day: traffic.since })}
        </p>
        <p className="m-0 max-w-prose text-[11.5px] leading-relaxed text-muted">
          {t('caveat')}
        </p>
      </div>
    </div>
  );
}
