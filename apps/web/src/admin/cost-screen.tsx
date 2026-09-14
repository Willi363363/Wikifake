// What the model has cost — step K.9, the digest.
//
// The spend, the two unit costs, the curve, and the table of what was called.
// The two layouts it was chosen over — unit economics as the page, and a ledger
// of tokens with money as a derived column — are gone with the question they
// answered.
//
// **The digest's own cost, stated by the lab that proposed it**: the total is
// the biggest number on a page where the total is the least useful figure, and
// it only means something divided by something. So the two divisions are tiles
// beside it rather than a line underneath, and the rate they were computed at
// is printed where the money is.
//
// **Money when a rate is configured, tokens always.** The rate is absent by
// default, so the ordinary state of this page is tokens plus an explanation,
// and that has to read as a deliberate answer rather than a broken figure. No
// rate lives in the repository: one written there is wrong within a quarter and
// says nothing when it goes stale.
import { useFormatter, useTranslations } from 'next-intl';

import type { CostView } from './cost.js';
import { CARD, Count, Key, LABEL, Sparkline, Tile } from './parts.js';

export interface CostSectionProps {
  readonly cost: CostView;
}

/** A number of tokens, in thousands once it stops being readable. */
function Tokens({ count }: { readonly count: number }) {
  const format = useFormatter();
  return <>{format.number(count, { notation: 'compact' })}</>;
}

export function CostSection({ cost }: CostSectionProps) {
  const t = useTranslations('admin.cost');
  const format = useFormatter();

  // No currency symbol, and I.6 decided that: the rate is two environment
  // variables of unnamed currency, so printing € would be the panel asserting
  // something no deployment ever told it.
  const money = (value: number | null, places = 2) =>
    value === null
      ? t('noRate')
      : format.number(value, { maximumFractionDigits: places });

  // The curve is spend when there is a rate and tokens when there is not —
  // the same series either way, because money here *is* tokens multiplied.
  const priced = cost.rate !== null;
  const columns = cost.days.map((day) => ({
    label: day.day,
    value: priced ? (day.spend ?? 0) : day.inputTokens + day.outputTokens,
  }));

  return (
    <div className="flex flex-col gap-4">
      {/* Said first, because it decides how every figure below is read. */}
      <p className="m-0 max-w-prose text-[12px] leading-relaxed text-ink-2">
        {priced ? t('rateSet') : t('noRateWhy')}
      </p>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tile
          label={t('spend')}
          value={money(cost.spend)}
          note={t('calls', { count: cost.totals.calls })}
          filled
        />
        {/* A cached round costs nothing to generate, so averaging it in makes
            generation look cheaper than it is — C4.6's insistence, and the
            reason the denominator is games *generated*. */}
        <Tile
          label={t('perGame')}
          value={money(cost.perGame, 4)}
          note={t('notPerServed')}
        />
        <Tile
          label={t('perPlayer')}
          value={money(cost.perPlayer, 3)}
          note={t('guestsIncluded')}
        />
        {/* Needs no rate, so it is the one unit figure that is always there. */}
        <Tile
          label={t('tokensPerGame')}
          value={
            cost.tokensPerGame === null ? (
              t('noRate')
            ) : (
              <Tokens count={Math.round(cost.tokensPerGame)} />
            )
          }
          note={t('inAndOut')}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.5fr]">
        <section className={`${CARD} flex flex-col gap-4 p-5`}>
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
            <h2 className="m-0 text-lg font-bold text-ink">
              {priced ? t('spendPerDay') : t('tokensPerDay')}
            </h2>
            <Key
              fill="bg-accent-line"
              label={priced ? t('spend') : t('columns.tokens')}
            />
          </div>

          {columns.length === 0 ? (
            <p className="m-0 text-sm text-ink-2">{t('nothing')}</p>
          ) : (
            <Sparkline columns={columns} height="h-40" />
          )}

          <p className="m-0 mt-auto border-t-3 border-line pt-3 font-mono text-[11px] leading-relaxed text-muted">
            {cost.rate === null
              ? t('noRateNames')
              : t('rateIs', {
                  input: format.number(cost.rate.inputPerMTok, {
                    maximumFractionDigits: 3,
                  }),
                  output: format.number(cost.rate.outputPerMTok, {
                    maximumFractionDigits: 3,
                  }),
                })}
          </p>
        </section>

        <section className={`${CARD} flex flex-col gap-3 p-5`}>
          <h2 className="m-0 text-lg font-bold text-ink">{t('byKind')}</h2>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-3 border-line-strong">
                  <th scope="col" className={`${LABEL} px-2 py-2 text-left`}>
                    {t('columns.kind')}
                  </th>
                  <th scope="col" className={`${LABEL} px-2 py-2 text-right`}>
                    {t('columns.calls')}
                  </th>
                  <th scope="col" className={`${LABEL} px-2 py-2 text-right`}>
                    {t('columns.failed')}
                  </th>
                  <th scope="col" className={`${LABEL} px-2 py-2 text-right`}>
                    {t('columns.input')}
                  </th>
                  <th scope="col" className={`${LABEL} px-2 py-2 text-right`}>
                    {t('columns.output')}
                  </th>
                  <th scope="col" className={`${LABEL} px-2 py-2 text-right`}>
                    {t('columns.cost')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {cost.byKind.length === 0 ? (
                  <tr>
                    <td className="px-2 py-2 text-ink-2" colSpan={6}>
                      {t('nothing')}
                    </td>
                  </tr>
                ) : (
                  cost.byKind.map((kind) => (
                    <tr key={kind.kind} className="border-b-1 border-line">
                      <td className="px-2 py-2.5 font-mono text-xs text-ink">
                        {kind.kind}
                      </td>
                      <td className="px-2 py-2.5 text-right font-mono text-[13px] tabular-nums text-ink">
                        <Count value={kind.calls} />
                      </td>
                      <td className="px-2 py-2.5 text-right font-mono text-[13px] tabular-nums text-muted">
                        <Count value={kind.failed} />
                      </td>
                      <td className="px-2 py-2.5 text-right font-mono text-[13px] tabular-nums text-muted">
                        <Tokens count={kind.inputTokens} />
                      </td>
                      <td className="px-2 py-2.5 text-right font-mono text-[13px] tabular-nums text-muted">
                        <Tokens count={kind.outputTokens} />
                      </td>
                      <td className="px-2 py-2.5 text-right font-mono text-[13px] font-bold tabular-nums text-ink">
                        {money(kind.spend, 4)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-1.5 border-t-3 border-line pt-3">
            {/* A failure still spends: the tokens went to the model either way,
                and hiding them would understate exactly the spend worth
                cutting. */}
            {cost.totals.failed === 0 ? null : (
              <p className="m-0 text-[11.5px] leading-relaxed text-muted">
                {t('failed', { count: cost.totals.failed })}
              </p>
            )}
            {cost.totals.withoutTokens === 0 ? null : (
              // `sum` skips a null, so a provider that stopped reporting would
              // make the totals fall while the spend rose. Said, not swallowed.
              <p className="m-0 text-[11.5px] leading-relaxed text-muted" role="note">
                {t('withoutTokens', { count: cost.totals.withoutTokens })}
              </p>
            )}
            <p className="m-0 text-[11.5px] leading-relaxed text-muted">
              {t('generatedDenominator', { count: cost.totals.gamesGenerated })}
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
