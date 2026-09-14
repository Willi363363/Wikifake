// Activation and return — step K.5, the funnel the owner chose.
//
// The two rates as figures, then the funnel itself. The two layouts it was
// chosen over — the gaps as the page, and four cards carrying the definitions —
// are gone with the question they answered.
//
// **The track says this is the number worth building the panel for.** Accounts
// created goes up and means nothing; the share of people who signed up and then
// played, and of people who played once and came back, is the one figure that
// says whether the game works. So it is the filled tile, and the funnel below
// it is how it was arrived at.
//
// **Two sentences it keeps**, because they are true of the numbers and not of
// the design: the period chooses *who signed up* and not when they played, and
// "came back" is a later day of activity rather than a cohort curve.
import { useFormatter, useTranslations } from 'next-intl';

import type { ActivationView } from './activation.js';
import { CARD, Count, Funnel, Tile } from './parts.js';

export interface ActivationSectionProps {
  readonly activation: ActivationView;
}

export function ActivationSection({ activation }: ActivationSectionProps) {
  const t = useTranslations('admin.activation');
  const format = useFormatter();
  /** A share, or an em dash. Null is *no whole*, not nought per cent. */
  const share = (value: number | null) =>
    value === null
      ? t('noWhole')
      : format.number(value, { style: 'percent', maximumFractionDigits: 1 });

  const step = (name: string) => activation.funnel.find((one) => one.name === name);
  const created = step('created')?.count ?? 0;
  const finished = step('finished')?.count ?? 0;
  const returned = step('returned')?.count ?? 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tile
          label={t('activation')}
          value={share(activation.activation)}
          note={t('activationWhy')}
          filled
        />
        <Tile
          label={t('returnRate')}
          value={share(activation.returnRate)}
          note={t('returnWhy')}
        />
        <Tile
          label={t('steps.created')}
          value={<Count value={created} />}
          note={t('inThisPeriod')}
        />
        <Tile
          label={t('steps.finished')}
          value={<Count value={finished} />}
          note={t('cameBack', { count: returned })}
        />
      </div>

      <section className={`${CARD} flex flex-col gap-4 p-5`}>
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          <h2 className="m-0 text-lg font-bold text-ink">{t('funnelTitle')}</h2>
          {/* The two numbers beside each bar, named once rather than guessed
              four times: the width is the share of the top, the first number is
              the share of the step above, and the second is the count. */}
          <span className="font-mono text-[11px] text-muted">{t('funnelLegend')}</span>
        </div>

        <Funnel
          bars={activation.funnel.map((one) => ({
            label: t(`steps.${one.name}`),
            count: one.count,
            ofPrevious: one.ofPrevious,
          }))}
        />

        <dl className="m-0 grid gap-x-6 gap-y-2 border-t-3 border-line pt-3 sm:grid-cols-2">
          {activation.funnel.map((one) => (
            <div key={one.name} className="flex min-w-0 flex-col">
              <dt className="text-[12px] font-bold text-ink-2">
                {t(`steps.${one.name}`)}
              </dt>
              <dd className="m-0 text-[11.5px] leading-relaxed text-muted">
                {t(`why.${one.name}`)}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="flex flex-col gap-1.5">
        {/* Said on the screen rather than left to be discovered: what "came
            back" can and cannot mean, given what is recorded. */}
        <p className="m-0 max-w-prose text-[11.5px] leading-relaxed text-muted">
          {t('caveat')}
        </p>
        {/* The period picks the cohort, not the rounds: "of the people who
            signed up then, how many played" is what an activation figure has
            always meant. */}
        <p className="m-0 max-w-prose text-[11.5px] leading-relaxed text-muted">
          {t('cohort')}
        </p>
      </div>
    </div>
  );
}
