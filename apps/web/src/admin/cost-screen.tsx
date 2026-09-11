// What the model has cost — step I.6.
//
// Money when a rate is configured, tokens always, and a sentence saying which
// of the two you are looking at. The rate is absent by default, so the ordinary
// state of this section is **tokens plus an explanation**, and that has to read
// as a deliberate answer rather than as a broken figure.
import { useFormatter, useTranslations } from 'next-intl';

import type { CostView } from './cost.js';

export interface CostSectionProps {
  readonly cost: CostView;
}

/** A number of tokens, in thousands once it stops being readable. */
function Tokens({ count }: { readonly count: number }) {
  const format = useFormatter();
  return <>{format.number(count, { notation: 'compact' })}</>;
}

function Figure({
  label,
  value,
  beside,
}: {
  readonly label: string;
  readonly value: React.ReactNode;
  readonly beside?: string;
}) {
  return (
    <div className="border-3 border-line-strong bg-surface px-3 py-2 shadow-md">
      <p className="font-mono text-[10px] tracking-[0.12em] text-muted uppercase">
        {label}
      </p>
      <p className="mt-1 font-mono text-2xl tabular-nums text-ink">{value}</p>
      {beside === undefined ? null : <p className="mt-1 text-xs text-muted">{beside}</p>}
    </div>
  );
}

export function CostSection({ cost }: CostSectionProps) {
  const t = useTranslations('admin.cost');
  const format = useFormatter();
  const money = (value: number | null) =>
    value === null ? t('noRate') : format.number(value, { maximumFractionDigits: 2 });

  return (
    <section aria-labelledby="admin-cost" className="mt-8">
      <h2
        id="admin-cost"
        className="font-mono text-xs tracking-[0.12em] text-muted uppercase"
      >
        {t('title')}
      </h2>

      {/* Said first, because it decides how every figure below is read. */}
      <p className="mt-2 max-w-prose text-sm text-muted">
        {cost.spend === null ? t('noRateWhy') : t('rateSet')}
      </p>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Figure
          label={t('spend')}
          value={money(cost.spend)}
          beside={t('calls', { count: cost.totals.calls })}
        />
        <Figure label={t('perGame')} value={money(cost.perGame)} />
        <Figure label={t('perPlayer')} value={money(cost.perPlayer)} />
        <Figure
          label={t('tokensPerGame')}
          value={
            cost.tokensPerGame === null ? (
              t('noRate')
            ) : (
              <Tokens count={Math.round(cost.tokensPerGame)} />
            )
          }
          beside={t('generated', { count: cost.totals.gamesGenerated })}
        />
      </div>

      {/* A failure still spends: the tokens went to the model either way, and
          hiding them would understate exactly the spend worth cutting. */}
      {cost.totals.failed === 0 ? null : (
        <p className="mt-2 text-xs text-muted">
          {t('failed', { count: cost.totals.failed })}
        </p>
      )}
      {cost.totals.withoutTokens === 0 ? null : (
        // `sum` skips a null, so a provider that stopped reporting would make
        // the totals fall while the spend rose. Said, rather than swallowed.
        <p className="mt-1 text-xs text-muted" role="note">
          {t('withoutTokens', { count: cost.totals.withoutTokens })}
        </p>
      )}

      <h3 className="mt-6 font-mono text-[10px] tracking-[0.12em] text-muted uppercase">
        {t('byKind')}
      </h3>
      <div className="mt-2 overflow-x-auto border-3 border-line-strong bg-surface shadow-md">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-3 border-line-strong">
              <th scope="col" className="px-3 py-2 text-left text-muted">
                {t('columns.kind')}
              </th>
              <th scope="col" className="px-3 py-2 text-right text-muted">
                {t('columns.calls')}
              </th>
              <th scope="col" className="px-3 py-2 text-right text-muted">
                {t('columns.failed')}
              </th>
              <th scope="col" className="px-3 py-2 text-right text-muted">
                {t('columns.input')}
              </th>
              <th scope="col" className="px-3 py-2 text-right text-muted">
                {t('columns.output')}
              </th>
            </tr>
          </thead>
          <tbody>
            {cost.byKind.length === 0 ? (
              <tr>
                <td className="px-3 py-2 text-ink-2" colSpan={5}>
                  {t('nothing')}
                </td>
              </tr>
            ) : (
              cost.byKind.map((kind) => (
                <tr key={kind.kind}>
                  <td className="px-3 py-2 font-mono text-xs text-ink">{kind.kind}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums text-ink">
                    {format.number(kind.calls)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums text-muted">
                    {format.number(kind.failed)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums text-muted">
                    <Tokens count={kind.inputTokens} />
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums text-muted">
                    <Tokens count={kind.outputTokens} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <h3 className="mt-6 font-mono text-[10px] tracking-[0.12em] text-muted uppercase">
        {t('perDay')}
      </h3>
      {cost.days.length === 0 ? (
        <p className="mt-2 text-sm text-ink-2">{t('nothing')}</p>
      ) : (
        <ul className="mt-2 space-y-1">
          {cost.days.map((day) => (
            <li
              key={day.day}
              className="flex items-baseline gap-3 border-3 border-line-strong bg-surface px-3 py-1 text-sm shadow-md"
            >
              <span className="font-mono text-xs text-muted">{day.day}</span>
              <span className="font-mono tabular-nums text-ink">
                {format.number(day.calls)}
              </span>
              <span className="ml-auto font-mono text-xs tabular-nums text-muted">
                <Tokens count={day.inputTokens + day.outputTokens} />
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
