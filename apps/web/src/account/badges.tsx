// The badges, on the profile — step M.2.
//
// The section answers two questions and the order is the point: *what do I
// hold*, then *what is next*. A list of things already true is a trophy case;
// the rung underneath is what makes it a ladder, which is the whole of track M.
//
// **A next row names the badge, not the metric.** The first draft labelled each
// row with its counter — "Rounds finished", "Best streak" — and the French
// profile test caught what that meant: the words were already on the screen, on
// the stat tile three inches above, saying a different number. One label, two
// meanings. Naming the rung says something the tile does not, and the duplicate
// disappears with it.
//
// **Nothing here decides anything.** Which badges are held, which rung is next
// and what a metric reads are all `@wikifake/domain` — a screen computing any of
// them would be a second place that can disagree about the order of the rungs.
import {
  badgesEarned,
  BADGES,
  metricValueOf,
  nextBadgeIn,
  RATIO_METRICS,
  type Badge,
  type BadgeMetric,
  type BadgeStats,
} from '@wikifake/domain';
import { useFormatter, useTranslations } from 'next-intl';

/** The ladders, in catalogue order and each reached once. */
const METRICS: readonly BadgeMetric[] = [...new Set(BADGES.map((badge) => badge.metric))];

export function Badges({ stats }: { readonly stats: BadgeStats }) {
  const t = useTranslations('account.badges');
  const format = useFormatter();

  const earned = badgesEarned(stats);
  const next = METRICS.map((metric) => nextBadgeIn(metric, stats)).filter(
    (badge): badge is Badge => badge !== null,
  );

  /**
   * How far off a rung is, as a sentence.
   *
   * **Not always the metric.** A ratio rung carries a floor of finished rounds,
   * so a player at 80% over five rounds is held back by the five and not by the
   * 80 — and a row reading `80% / 75%` would say they had earned something they
   * had not. The blocking condition is shown instead, in rounds, which is why
   * it has a message of its own rather than sharing `progress`.
   */
  const gap = (badge: Badge): string => {
    if (stats.gamesFinished < badge.minFinished) {
      return t('floorProgress', {
        current: format.number(stats.gamesFinished),
        target: format.number(badge.minFinished),
      });
    }

    const value = metricValueOf(badge.metric, stats);
    const percent = RATIO_METRICS.includes(badge.metric);
    const shown = (figure: number): string =>
      percent ? format.number(figure, { style: 'percent' }) : format.number(figure);

    return t('progress', {
      current: value === null ? '—' : shown(value),
      target: shown(badge.threshold),
    });
  };

  return (
    <section className="flex flex-col gap-4 rounded-xl bg-surface p-5">
      <h2 className="m-0 flex flex-wrap items-baseline justify-between gap-x-3 text-base text-ink">
        <span className="font-mono text-[10px] tracking-[0.12em] text-muted uppercase">
          {t('title')}
        </span>
        <span className="font-mono text-sm font-semibold tabular-nums text-ink">
          {t('held', { held: earned.length, total: BADGES.length })}
        </span>
      </h2>

      {earned.length === 0 ? (
        <p className="m-0 text-sm text-ink-2">{t('empty')}</p>
      ) : (
        <ul aria-label={t('title')} className="m-0 flex list-none flex-wrap gap-2 p-0">
          {earned.map((badge) => (
            // `accent-soft` under `ink` is the measured pair `contrast.ts` names
            // "the accent badge" — a tile separated by being a different
            // surface, which is what the direction asks for instead of a border.
            <li
              key={badge.id}
              className="rounded-full bg-accent-soft px-3 py-1 text-sm text-ink"
            >
              {t(`names.${badge.id}`)}
            </li>
          ))}
        </ul>
      )}

      {/* Named, so that "is this rung being climbed or already held" is a
          question the document can answer — to a screen reader and to a test. */}
      <section aria-label={t('next')} className="flex flex-col gap-2">
        <p className="m-0 font-mono text-[10px] tracking-[0.12em] text-muted uppercase">
          {t('next')}
        </p>
        {next.length === 0 ? (
          <p className="m-0 text-sm text-ink-2">{t('complete')}</p>
        ) : (
          <dl className="m-0 grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 text-sm">
            {next.map((badge) => (
              <div key={badge.id} className="contents">
                <dt className="text-ink-2">{t(`names.${badge.id}`)}</dt>
                <dd className="m-0 font-mono tabular-nums text-ink">{gap(badge)}</dd>
              </div>
            ))}
          </dl>
        )}
      </section>
    </section>
  );
}
