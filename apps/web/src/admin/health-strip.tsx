// Health, in one line — step K.3.
//
// The Overview's last row. It is deliberately not the health *page*: this says
// whether anything is on fire, and `/admin/health` says what each service
// answered and how long it took. A summary that repeated the page would be a
// reason not to open the page.
//
// **A swatch beside a name, never a coloured name.** The state is a block of
// colour and the words stay `ink` — the rule the whole direction turns on, and
// the one thirty-two screens broke when the accents became fills.
import { useTranslations } from 'next-intl';

import type { HealthView } from './health.js';
import { CARD, LABEL } from './parts.js';

export interface HealthStripProps {
  readonly health: HealthView;
}

/**
 * What the two services agree about, or that nothing can be told.
 *
 * Three answers and not two: *one of them is down, or neither was deployed
 * from git* is a different sentence from *they disagree*, and I.2 kept them
 * apart for the same reason `shareOf` keeps null and zero apart.
 */
function commitKey(sameCommit: boolean | null) {
  if (sameCommit === null) return 'commitUnknown' as const;
  return sameCommit ? ('commitAgree' as const) : ('commitDisagree' as const);
}

export function HealthStrip({ health }: HealthStripProps) {
  const t = useTranslations('admin.health');

  return (
    <section
      aria-label={t('title')}
      className={`${CARD} flex flex-wrap items-center gap-x-6 gap-y-3 p-4`}
    >
      <span className={LABEL}>{t('title')}</span>

      {health.readings.map((reading) => (
        <span key={reading.name} className="flex items-center gap-2">
          <span
            className={`size-2.5 border-2 border-line-strong ${
              reading.up ? 'bg-green' : 'bg-danger'
            }`}
          />
          <span className="text-[13px] text-ink-2">{t(`services.${reading.name}`)}</span>
          <span className="sr-only">{reading.up ? t('up') : t('down')}</span>
          {reading.ms > 0 ? (
            <span className="font-mono text-[11px] tabular-nums text-muted">
              {reading.ms} ms
            </span>
          ) : null}
        </span>
      ))}

      <span className="max-w-prose text-[11px] text-muted">
        {t(commitKey(health.sameCommit))}
      </span>
    </section>
  );
}
