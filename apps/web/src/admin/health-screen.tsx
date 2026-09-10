// The health section — step I.2.
//
// A table of readings, and one sentence above it that is the actual answer:
// **do the two services agree about what is deployed.** Everything else on this
// section is context for that line.
//
// No colour carries meaning on its own. Up and down are words as well as a
// wash, because three states told apart by hue alone is three states nobody
// colour-blind can tell apart — the paragraph token's own rule, and it applies
// hardest on the screen somebody reads while something is broken.
import { useFormatter, useTranslations } from 'next-intl';

import type { HealthView, Reading } from './health.js';

export interface HealthSectionProps {
  readonly health: HealthView;
}

function ReadingRow({ reading }: { readonly reading: Reading }) {
  const t = useTranslations('admin.health');
  const format = useFormatter();

  return (
    <tr>
      <td className="px-3 py-2 text-ink">{t(`services.${reading.name}`)}</td>
      <td className="px-3 py-2">
        <span
          className={
            reading.up
              ? 'border-3 border-line-strong bg-green-soft px-2 py-0.5 font-mono text-[10px] tracking-[0.12em] text-ink uppercase'
              : 'border-3 border-line-strong bg-danger-soft px-2 py-0.5 font-mono text-[10px] tracking-[0.12em] text-ink uppercase'
          }
        >
          {reading.up ? t('up') : t('down')}
        </span>
      </td>
      {/* The time it took to fail is the difference between refused and timed
          out, so it is shown for a failure too. */}
      <td className="px-3 py-2 text-right font-mono tabular-nums text-muted">
        {format.number(Math.round(reading.ms))} ms
      </td>
      <td className="px-3 py-2 font-mono text-xs text-muted">
        {reading.commit === undefined || reading.commit === ''
          ? reading.detail
          : `${reading.detail} · ${reading.commit.slice(0, 7)}`}
      </td>
    </tr>
  );
}

export function HealthSection({ health }: HealthSectionProps) {
  const t = useTranslations('admin.health');

  return (
    <section aria-labelledby="admin-health" className="mt-8">
      <h2
        id="admin-health"
        className="font-mono text-xs tracking-[0.12em] text-muted uppercase"
      >
        {t('title')}
      </h2>

      {/* The line this section exists for. Three states and three sentences:
          agreeing, disagreeing, and not knowable — because "unknown" and
          "disagreeing" are not the same news, and a page that showed the same
          thing for both would be the page that hid a half-finished deploy. */}
      <p
        className={
          health.sameCommit === false
            ? 'mt-3 border-3 border-line-strong bg-danger-soft px-3 py-2 text-sm text-ink'
            : 'mt-3 text-sm text-ink-2'
        }
        {...(health.sameCommit === false ? { role: 'alert' as const } : {})}
      >
        {health.sameCommit === null
          ? t('commitUnknown')
          : health.sameCommit
            ? t('commitAgree')
            : t('commitDisagree')}
      </p>

      <div className="mt-3 overflow-x-auto border-3 border-line-strong bg-surface shadow-md">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-3 border-line-strong">
              <th scope="col" className="px-3 py-2 text-left text-muted">
                {t('columns.service')}
              </th>
              <th scope="col" className="px-3 py-2 text-left text-muted">
                {t('columns.state')}
              </th>
              <th scope="col" className="px-3 py-2 text-right text-muted">
                {t('columns.took')}
              </th>
              <th scope="col" className="px-3 py-2 text-left text-muted">
                {t('columns.says')}
              </th>
            </tr>
          </thead>
          <tbody>
            {health.readings.map((reading) => (
              <ReadingRow key={reading.name} reading={reading} />
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-2 font-mono text-[10px] tracking-[0.12em] text-muted uppercase">
        {t('model', {
          model: health.identity.model,
          configured: health.identity.llmConfigured ? t('yes') : t('no'),
        })}
      </p>
    </section>
  );
}
