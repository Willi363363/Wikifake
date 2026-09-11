// Activation and return — step I.4.
//
// **Two figures at the top and the working below them.** The track says the
// ratio of people who signed up to people who played is the one number that
// says whether the game works, so it is the one number in large type; the
// funnel underneath is how it was arrived at.
//
// A bar per step, drawn as a width, and the number beside it in words. The bar
// is decoration — `aria-hidden` — because a length is not a fact a screen
// reader can read, and the percentage is already there in text.
import { useFormatter, useTranslations } from 'next-intl';

import type { ActivationView, Step } from './activation.js';

export interface ActivationSectionProps {
  readonly activation: ActivationView;
}

/** A share, or an em dash. Null is *no whole*, which is not nought per cent. */
function Share({ share }: { readonly share: number | null }) {
  const format = useFormatter();
  const t = useTranslations('admin.activation');

  return (
    <>
      {share === null
        ? t('noWhole')
        : format.number(share, { style: 'percent', maximumFractionDigits: 1 })}
    </>
  );
}

function FunnelRow({ step }: { readonly step: Step }) {
  const t = useTranslations('admin.activation');
  const format = useFormatter();
  // The bar is the share of the top of the funnel, so four bars read as a
  // funnel rather than as four unrelated proportions.
  const width = step.ofCreated ?? 1;

  return (
    <li className="border-3 border-line-strong bg-surface px-3 py-2 shadow-md">
      <div className="flex flex-wrap items-baseline gap-x-3">
        <span className="font-mono text-[10px] tracking-[0.12em] text-muted uppercase">
          {t(`steps.${step.name}`)}
        </span>
        <span className="font-mono text-lg tabular-nums text-ink">
          {format.number(step.count)}
        </span>
        {step.ofPrevious === null ? null : (
          <span className="text-xs text-muted">
            {t('ofPrevious', { name: '' })}
            <Share share={step.ofPrevious} />
          </span>
        )}
      </div>

      <div aria-hidden className="mt-2 h-2 border-3 border-line-strong bg-bg-grain">
        <span
          className="block h-full bg-accent"
          style={{ width: `${String(Math.round(width * 100))}%` }}
        />
      </div>

      <p className="mt-1 text-xs text-muted">{t(`why.${step.name}`)}</p>
    </li>
  );
}

export function ActivationSection({ activation }: ActivationSectionProps) {
  const t = useTranslations('admin.activation');

  return (
    <section aria-labelledby="admin-activation" className="mt-8">
      <h2
        id="admin-activation"
        className="font-mono text-xs tracking-[0.12em] text-muted uppercase"
      >
        {t('title')}
      </h2>

      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="border-3 border-line-strong bg-surface px-3 py-3 shadow-md">
          <p className="font-mono text-[10px] tracking-[0.12em] text-muted uppercase">
            {t('activation')}
          </p>
          <p className="mt-1 font-mono text-3xl tabular-nums text-ink">
            <Share share={activation.activation} />
          </p>
          <p className="mt-1 text-xs text-muted">{t('activationWhy')}</p>
        </div>
        <div className="border-3 border-line-strong bg-surface px-3 py-3 shadow-md">
          <p className="font-mono text-[10px] tracking-[0.12em] text-muted uppercase">
            {t('returnRate')}
          </p>
          <p className="mt-1 font-mono text-3xl tabular-nums text-ink">
            <Share share={activation.returnRate} />
          </p>
          <p className="mt-1 text-xs text-muted">{t('returnWhy')}</p>
        </div>
      </div>

      <ul className="mt-3 space-y-2">
        {activation.funnel.map((step) => (
          <FunnelRow key={step.name} step={step} />
        ))}
      </ul>

      {/* Said on the screen rather than left to be discovered: what "came back"
          can and cannot mean, given what is recorded. */}
      <p className="mt-3 max-w-prose text-xs text-muted">{t('caveat')}</p>
      {/* I.8 — the range picks the cohort, not the rounds: `player_stats` has
          running totals with no date on them, and "of the people who signed up
          then, how many played" is what an activation figure has always meant. */}
      <p className="mt-1 max-w-prose text-xs text-muted">{t('cohort')}</p>
    </section>
  );
}
