// The probes — step K.10, the status board the owner chose.
//
// One card per service, big, then the commit agreement, then what this build
// is. The two layouts it was chosen over — the table as the page, and the
// deployment question first — are gone with the question they answered.
//
// **The line this page exists for is the commit one.** The site being open
// already answers whether it is up; what nothing else on the panel would notice
// is a deployment that half succeeded, leaving the web app and the socket
// server on different commits while the game keeps serving pages and the two
// disagree about what the protocol is.
//
// **No colour carries meaning on its own.** Up and down are words as well as a
// wash, because three states told apart by hue alone is three states nobody
// colour-blind can tell apart — the paragraph token's own rule, and it applies
// hardest on the screen somebody reads while something is broken.
import { useFormatter, useTranslations } from 'next-intl';

import type { HealthView, Reading } from './health.js';
import { CARD, Figure, LABEL, PANEL } from './parts.js';

export interface HealthSectionProps {
  readonly health: HealthView;
}

/** One service, given a card of its own. */
function ServiceCard({ reading }: { readonly reading: Reading }) {
  const t = useTranslations('admin.health');
  const format = useFormatter();

  return (
    <section
      aria-label={t(`services.${reading.name}`)}
      className={`${CARD} flex flex-col gap-3 p-5 ${
        reading.up ? 'bg-green-soft' : 'bg-danger-soft'
      }`}
    >
      <span className={LABEL}>{t(`services.${reading.name}`)}</span>

      <div className="flex items-center gap-3">
        <span
          className={`size-6 shrink-0 border-3 border-line-strong ${
            reading.up ? 'bg-green' : 'bg-danger'
          }`}
        />
        <span className="text-3xl leading-none font-extrabold text-ink">
          {reading.up ? t('up') : t('down')}
        </span>
      </div>

      {/* The time it took to fail is the difference between refused and timed
          out, so it is shown for a failure too. Nought means this process,
          which answered by being the one rendering the page. */}
      <span className="font-mono text-[12px] text-muted">
        {reading.ms === 0
          ? t('thisPage')
          : t('answeredIn', { ms: format.number(Math.round(reading.ms)) })}
      </span>

      <span className="font-mono text-[11px] break-words text-muted">
        {reading.commit === undefined || reading.commit === ''
          ? reading.detail
          : `${reading.detail} · ${reading.commit.slice(0, 7)}`}
      </span>
    </section>
  );
}

export function HealthSection({ health }: HealthSectionProps) {
  const t = useTranslations('admin.health');

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-3">
        {health.readings.map((reading) => (
          <ServiceCard key={reading.name} reading={reading} />
        ))}
      </div>

      {/* Three states and three sentences: agreeing, disagreeing, and not
          knowable — because "unknown" and "disagreeing" are not the same news,
          and a page that showed the same thing for both would be the page that
          hid a half-finished deploy. */}
      <p
        className={
          health.sameCommit === false
            ? 'm-0 border-3 border-line-strong bg-danger-soft px-4 py-3 text-sm text-ink'
            : 'm-0 border-3 border-line px-4 py-3 text-sm text-ink-2'
        }
        {...(health.sameCommit === false ? { role: 'alert' as const } : {})}
      >
        {health.sameCommit === null
          ? t('commitUnknown')
          : health.sameCommit
            ? t('commitAgree')
            : t('commitDisagree')}
      </p>

      <section
        aria-label={t('thisBuild')}
        className={`${PANEL} flex flex-wrap gap-x-10 gap-y-4 p-4`}
      >
        <Figure label={t('version')} value={health.identity.version} />
        <Figure
          label={t('commit')}
          value={
            health.identity.commitShort === ''
              ? t('noCommit')
              : health.identity.commitShort
          }
        />
        {/* "Key configured" says a variable exists, not that the key works.
            Only playing a round says that. */}
        <Figure
          label={t('modelLabel')}
          value={health.identity.model}
          note={health.identity.llmConfigured ? t('keySet') : t('noKey')}
        />
      </section>

      <p className="m-0 max-w-prose text-[11.5px] leading-relaxed text-muted">
        {t('live')}
      </p>
    </div>
  );
}
