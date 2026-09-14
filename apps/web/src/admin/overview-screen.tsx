// Overview — step K.3, the digest the owner chose.
//
// Four figures big enough to read from a doorway, then the two shapes that say
// whether they are going the right way, then one line of health. The two
// layouts it was chosen over — a briefing shaped like the rail, and a console
// of twenty-four cells — are gone with the question they answered.
//
// **It invents no figure.** Every number here is one a section page draws in
// full, read through the same reader; this page decides which four are worth
// interrupting somebody with. That is the whole difference between a summary
// and a seventh section.
import { useFormatter, useTranslations } from 'next-intl';

import type { ActivationView } from './activation.js';
import type { CostView } from './cost.js';
import type { GamesView } from './games.js';
import { HealthStrip } from './health-strip.js';
import type { HealthView } from './health.js';
import { CARD, Count, Funnel, Percent, Sparkline, Tile } from './parts.js';
import type { PlayersView } from './players.js';
import { shareOf } from './activation.js';
import type { TrafficView } from './traffic.js';

export interface OverviewSectionProps {
  readonly players: PlayersView;
  readonly activation: ActivationView;
  readonly games: GamesView;
  readonly traffic: TrafficView;
  readonly cost: CostView;
  readonly health: HealthView;
}

export function OverviewSection({
  players,
  activation,
  games,
  traffic,
  cost,
  health,
}: OverviewSectionProps) {
  const t = useTranslations('admin');
  const format = useFormatter();

  const share = (value: number | null) =>
    value === null
      ? t('activation.noWhole')
      : format.number(value, { style: 'percent', maximumFractionDigits: 1 });
  // No currency symbol, and I.6 decided that: the rate is two environment
  // variables of unnamed currency, so printing € would be the panel asserting
  // something no deployment ever told it.
  const money = (value: number | null) =>
    value === null
      ? t('cost.noRate')
      : format.number(value, { maximumFractionDigits: 2 });

  // Oldest first: a chart is read left to right, and `readTraffic` answers most
  // recent first because a table is read top down. One reversal, here.
  const arrivals = [...traffic.days]
    .reverse()
    .map((day) => ({ label: day.day, value: day.landing }));

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tile
          label={t('players.accounts')}
          value={<Count value={players.accounts} />}
          note={t('players.guests', { count: players.guests })}
        />
        {/* A fixed window whatever the period says, and it says so — the bar
            above already told the reader once, and this is the figure it was
            talking about. */}
        <Tile
          label={t('players.activeToday')}
          value={<Count value={players.activeToday} />}
          note={t('players.thisWeek', { count: players.activeThisWeek })}
        />
        <Tile
          label={t('games.title')}
          value={<Count value={games.total.rounds} />}
          note={t('overview.soloShare', {
            share: share(
              shareOf(
                games.rows.find((row) => row.mode === 'solo')?.rounds ?? 0,
                games.total.rounds,
              ),
            ),
          })}
        />
        {/* The one figure filled, because it is the one that surprises people.
            Tokens when no rate is set: the panel reports what it measured. */}
        <Tile
          label={cost.spend === null ? t('cost.tokensPerGame') : t('cost.spend')}
          value={
            cost.spend === null
              ? format.number(cost.tokensPerGame ?? 0, { notation: 'compact' })
              : money(cost.spend)
          }
          note={
            cost.spend === null
              ? t('cost.noRate')
              : t('overview.perRound', { amount: money(cost.perGame) })
          }
          filled
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <section className={`${CARD} flex flex-col gap-4 p-5`}>
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
            <h2 className="m-0 text-lg font-bold text-ink">{t('activation.title')}</h2>
            <span className="text-xs text-muted">
              {t('overview.activationOf', { share: share(activation.activation) })}
            </span>
          </div>
          <Funnel
            bars={activation.funnel.map((step) => ({
              label: t(`activation.steps.${step.name}`),
              count: step.count,
              ofPrevious: step.ofPrevious,
            }))}
          />
        </section>

        <section className={`${CARD} flex flex-col gap-4 p-5`}>
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
            <h2 className="m-0 text-lg font-bold text-ink">{t('traffic.title')}</h2>
            <span className="font-mono text-xs font-bold text-ink">
              <Percent share={traffic.reach} nothing={t('traffic.none')} />
            </span>
          </div>
          {arrivals.length === 0 ? (
            <p className="m-0 text-sm text-ink-2">{t('traffic.empty')}</p>
          ) : (
            <Sparkline columns={arrivals} height="h-28" />
          )}
          <div className="flex items-center justify-between border-t border-line pt-3">
            <span className="text-[13px] text-ink-2">{t('traffic.landing')}</span>
            <span className="font-mono text-sm font-bold tabular-nums text-ink">
              <Count value={traffic.landing} />
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-ink-2">{t('traffic.entry')}</span>
            <span className="font-mono text-sm font-bold tabular-nums text-ink">
              <Count value={traffic.entry} />
            </span>
          </div>
        </section>
      </div>

      <HealthStrip health={health} />

      {/* Said on the page that is about all eight, rather than on each of them:
          what this panel is, and the promise it keeps by construction. */}
      <div className="flex flex-col gap-1.5">
        <p className="m-0 max-w-prose text-[12px] leading-relaxed text-ink-2">
          {t('lead')}
        </p>
        <p className="m-0 max-w-prose text-[11.5px] leading-relaxed text-muted">
          {t('readOnly')}
        </p>
      </div>
    </div>
  );
}
