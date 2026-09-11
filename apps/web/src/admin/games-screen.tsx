// Rounds, and where they are lost — step I.5.
//
// One table, a row per mode and a total. The abandon rate is the column worth
// reading, and it is the one that needs its footnote said out loud: **it counts
// only rounds that have ended**, because a seat in a round still running has
// not abandoned anything.
//
// What this section cannot show is the track's *by screen*. The screens before
// a round exists leave no row, so the split is by mode — where the two abandon
// for different reasons, which is the more useful cut anyway.
import { useFormatter, useTranslations } from 'next-intl';

import type { GamesView, ModeRow } from './games.js';

export interface GamesSectionProps {
  readonly games: GamesView;
}

function Rate({ rate }: { readonly rate: number | null }) {
  const format = useFormatter();
  const t = useTranslations('admin.games');

  return (
    <>
      {rate === null
        ? t('noRounds')
        : format.number(rate, { style: 'percent', maximumFractionDigits: 1 })}
    </>
  );
}

function Row({ row, total }: { readonly row: ModeRow; readonly total: boolean }) {
  const t = useTranslations('admin.games');
  const format = useFormatter();
  const n = (value: number) => format.number(value);

  return (
    <tr className={total ? 'border-t-3 border-line-strong' : undefined}>
      <td className="px-3 py-2 text-ink">{t(`modes.${row.mode}`)}</td>
      <td className="px-3 py-2 text-right font-mono tabular-nums text-ink">
        {n(row.rounds)}
      </td>
      <td className="px-3 py-2 text-right font-mono tabular-nums text-muted">
        {n(row.open)}
      </td>
      <td className="px-3 py-2 text-right font-mono tabular-nums text-muted">
        {n(row.seats)}
      </td>
      <td className="px-3 py-2 text-right font-mono tabular-nums text-muted">
        {n(row.abandoned)}
      </td>
      <td className="px-3 py-2 text-right font-mono tabular-nums text-ink">
        <Rate rate={row.abandonRate} />
      </td>
    </tr>
  );
}

export function GamesSection({ games }: GamesSectionProps) {
  const t = useTranslations('admin.games');

  return (
    <section aria-labelledby="admin-games" className="mt-8">
      <h2
        id="admin-games"
        className="font-mono text-xs tracking-[0.12em] text-muted uppercase"
      >
        {t('title')}
      </h2>

      <div className="mt-3 border-3 border-line-strong bg-surface px-3 py-3 shadow-md">
        <p className="font-mono text-[10px] tracking-[0.12em] text-muted uppercase">
          {t('abandonRate')}
        </p>
        <p className="mt-1 font-mono text-3xl tabular-nums text-ink">
          <Rate rate={games.total.abandonRate} />
        </p>
        <p className="mt-1 text-xs text-muted">{t('abandonWhy')}</p>
      </div>

      <div className="mt-3 overflow-x-auto border-3 border-line-strong bg-surface shadow-md">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-3 border-line-strong">
              <th scope="col" className="px-3 py-2 text-left text-muted">
                {t('columns.mode')}
              </th>
              <th scope="col" className="px-3 py-2 text-right text-muted">
                {t('columns.rounds')}
              </th>
              <th scope="col" className="px-3 py-2 text-right text-muted">
                {t('columns.open')}
              </th>
              <th scope="col" className="px-3 py-2 text-right text-muted">
                {t('columns.seats')}
              </th>
              <th scope="col" className="px-3 py-2 text-right text-muted">
                {t('columns.abandoned')}
              </th>
              <th scope="col" className="px-3 py-2 text-right text-muted">
                {t('columns.rate')}
              </th>
            </tr>
          </thead>
          <tbody>
            {games.rows.map((row) => (
              <Row key={row.mode} row={row} total={false} />
            ))}
            <Row row={games.total} total />
          </tbody>
        </table>
      </div>

      {/* Both limits, said rather than left to be inferred from the columns. */}
      <p className="mt-3 max-w-prose text-xs text-muted">{t('caveat')}</p>
    </section>
  );
}
