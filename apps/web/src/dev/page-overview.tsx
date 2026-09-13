// Overview — settled, and the layout that was chosen.
//
// O1, the digest: four figures big enough to read from a doorway, then the two
// shapes that say whether they are going the right way. The two it was chosen
// over — a briefing shaped like the rail, and a console of twenty-four cells —
// are gone with the question they answered.
import { count, euros, percent, type Sample } from './sample-data.js';
import { CARD, Funnel, Health, LABEL, Sparkline, Tile } from './parts.js';

/** O1 — the digest. Four headline figures, then the two shapes. */
export function Digest({ data }: { readonly data: Sample }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tile
          label="Accounts"
          value={count(data.players.accounts)}
          note={`+ ${String(data.activation.steps[0]?.count ?? 0)} this month`}
        />
        <Tile
          label="Active today"
          value={count(data.players.activeToday)}
          note={`${count(data.players.activeThisWeek)} this week`}
        />
        <Tile
          label="Rounds"
          value={count(data.games.rounds)}
          note={`${percent(data.games.solo / data.games.rounds)} solo`}
        />
        <Tile
          label="Model spend"
          value={euros(data.cost.spend)}
          note={`${euros(data.cost.perGame, 4)} a round`}
          filled
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <section className={`${CARD} flex flex-col gap-4 p-5`}>
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="m-0 text-lg font-bold text-ink">Activation</h2>
            <span className="text-xs text-muted">
              {percent(data.activation.activation)} of new accounts finish a round
            </span>
          </div>
          <Funnel steps={data.activation.steps} />
        </section>

        <section className={`${CARD} flex flex-col gap-4 p-5`}>
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="m-0 text-lg font-bold text-ink">Arrivals</h2>
            <span className="font-mono text-xs font-bold text-ink">
              {percent(data.traffic.reach)} reach
            </span>
          </div>
          <Sparkline days={data.traffic.days} height="h-28" />
          <div className="flex items-center justify-between border-t-3 border-line pt-3">
            <span className="text-[13px] text-ink-2">Landing</span>
            <span className="font-mono text-sm font-bold text-ink">
              {count(data.traffic.landing)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-ink-2">Entry screen</span>
            <span className="font-mono text-sm font-bold text-ink">
              {count(data.traffic.entry)}
            </span>
          </div>
        </section>
      </div>

      <section className={`${CARD} flex flex-wrap items-center gap-x-6 gap-y-3 p-4`}>
        <span className={LABEL}>Health</span>
        <Health services={data.health.services} sameCommit={data.health.sameCommit} />
      </section>
    </div>
  );
}
