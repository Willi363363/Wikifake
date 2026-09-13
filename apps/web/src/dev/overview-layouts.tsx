// Three Overview pages, one set of figures.
//
// Overview is the page that answers *how is it going* before anybody picks a
// section, and there is more than one honest answer to that. These three differ
// on what they put first, not on what they know.
import { count, euros, percent, SAMPLE } from './overview-data.js';
import {
  CARD,
  Figure,
  Funnel,
  Health,
  Into,
  LABEL,
  PANEL,
  Sparkline,
  Tile,
} from './overview-parts.js';

export type LayoutId = 'digest' | 'briefing' | 'console';

export interface Layout {
  readonly id: LayoutId;
  readonly name: string;
  readonly bet: string;
  readonly cost: string;
}

export const LAYOUTS: readonly Layout[] = [
  {
    id: 'digest',
    name: 'O1 — digest',
    bet: 'Four numbers big enough to read from a doorway, then the two charts that say whether they are going the right way.',
    cost: 'Four figures is a choice about what matters, and the fifth most important thing is nowhere on the page.',
  },
  {
    id: 'briefing',
    name: 'O2 — briefing',
    bet: 'The page is shaped like the rail: one sentence, then Audience, The game and System each summarised and each a door into itself.',
    cost: 'Nothing is the headline except the sentence, so a number that moved overnight does not announce itself.',
  },
  {
    id: 'console',
    name: 'O3 — console',
    bet: 'Everything at once, in one grid, no prose — for somebody who opens this daily and already knows what each figure means.',
    cost: 'It is unreadable on the first visit, and it has no opinion about which figure is in trouble.',
  },
];

/** O1 — the digest. Four headline figures, then the two shapes. */
export function Digest() {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tile
          label="Accounts"
          value={count(SAMPLE.players.accounts)}
          note={`+ ${String(SAMPLE.activation.steps[0]?.count ?? 0)} this month`}
        />
        <Tile
          label="Active today"
          value={count(SAMPLE.players.activeToday)}
          note={`${count(SAMPLE.players.activeThisWeek)} this week`}
        />
        <Tile
          label="Rounds"
          value={count(SAMPLE.games.rounds)}
          note={`${percent(SAMPLE.games.solo / SAMPLE.games.rounds)} solo`}
        />
        <Tile
          label="Model spend"
          value={euros(SAMPLE.cost.spend)}
          note={`${euros(SAMPLE.cost.perGame, 4)} a round`}
          filled
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <section className={`${CARD} flex flex-col gap-4 p-5`}>
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="m-0 text-lg font-bold text-ink">Activation</h2>
            <span className="text-xs text-muted">
              {percent(SAMPLE.activation.activation)} of new accounts finish a round
            </span>
          </div>
          <Funnel steps={SAMPLE.activation.steps} />
        </section>

        <section className={`${CARD} flex flex-col gap-4 p-5`}>
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="m-0 text-lg font-bold text-ink">Arrivals</h2>
            <span className="font-mono text-xs font-bold text-ink">
              {percent(SAMPLE.traffic.reach)} reach
            </span>
          </div>
          <Sparkline days={SAMPLE.traffic.days} height="h-28" />
          <div className="flex items-center justify-between border-t-3 border-line pt-3">
            <span className="text-[13px] text-ink-2">Landing</span>
            <span className="font-mono text-sm font-bold text-ink">
              {count(SAMPLE.traffic.landing)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-ink-2">Entry screen</span>
            <span className="font-mono text-sm font-bold text-ink">
              {count(SAMPLE.traffic.entry)}
            </span>
          </div>
        </section>
      </div>

      <section className={`${CARD} flex flex-wrap items-center gap-x-6 gap-y-3 p-4`}>
        <span className={LABEL}>Health</span>
        <Health services={SAMPLE.health.services} sameCommit={SAMPLE.health.sameCommit} />
      </section>
    </div>
  );
}

/** O2 — the briefing. One sentence, then the rail's three groups. */
export function Briefing() {
  return (
    <div className="flex flex-col gap-4">
      <section className={`${CARD} flex flex-col gap-3 p-6`}>
        <span className={LABEL}>{SAMPLE.range.label}</span>
        <p className="m-0 max-w-4xl text-2xl leading-snug font-bold text-ink">
          {count(SAMPLE.players.activeInRange)} players were active, and{' '}
          {percent(SAMPLE.activation.activation)} of the{' '}
          {String(SAMPLE.activation.steps[0]?.count ?? 0)} accounts created finished a
          round. It cost {euros(SAMPLE.cost.spend)} to run.
        </p>
        <Health services={SAMPLE.health.services} sameCommit={SAMPLE.health.sameCommit} />
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className={`${CARD} flex flex-col gap-4 p-5`}>
          <h2 className="m-0 text-lg font-bold text-ink">Audience</h2>
          <div className={`${PANEL} flex flex-col gap-4 p-4`}>
            <Figure
              label="Active"
              value={count(SAMPLE.players.activeInRange)}
              note={`${count(SAMPLE.players.activeToday)} today`}
            />
            <Figure
              label="Accounts"
              value={count(SAMPLE.players.accounts)}
              note={`${count(SAMPLE.players.guests)} guests besides`}
            />
            <Figure
              label="Activation"
              value={percent(SAMPLE.activation.activation)}
              note={`${percent(SAMPLE.activation.returnRate)} come back`}
            />
          </div>
          <Sparkline days={SAMPLE.traffic.days} height="h-14" />
          <Into label="Open Audience" />
        </section>

        <section className={`${CARD} flex flex-col gap-4 p-5`}>
          <h2 className="m-0 text-lg font-bold text-ink">The game</h2>
          <div className={`${PANEL} flex flex-col gap-4 p-4`}>
            <Figure
              label="Rounds"
              value={count(SAMPLE.games.rounds)}
              note={`${String(SAMPLE.games.open)} still open`}
            />
            <Figure
              label="Abandoned"
              value={percent(SAMPLE.games.abandonRate)}
              note="of seats in finished rounds"
            />
            <Figure
              label="Articles"
              value={count(SAMPLE.content.distinctTopics)}
              note={`most played: ${SAMPLE.content.topTopic}`}
            />
          </div>
          <div className="flex items-center justify-between border-t-3 border-line pt-3">
            <span className="text-[13px] text-ink-2">Served from cache</span>
            <span className="font-mono text-sm font-bold text-ink">
              {percent(SAMPLE.content.cacheHitRate)}
            </span>
          </div>
          <Into label="Open The game" />
        </section>

        <section className={`${CARD} flex flex-col gap-4 p-5`}>
          <h2 className="m-0 text-lg font-bold text-ink">System</h2>
          <div className={`${PANEL} flex flex-col gap-4 p-4`}>
            <Figure
              label="Model spend"
              value={euros(SAMPLE.cost.spend)}
              note={`${euros(SAMPLE.cost.perGame, 4)} a round`}
            />
            <Figure
              label="Generated"
              value={count(SAMPLE.content.generated)}
              note={`${count(SAMPLE.cost.tokensPerGame)} tokens each`}
            />
            <Figure
              label="Per player"
              value={euros(SAMPLE.cost.perPlayer, 3)}
              note="over the period"
            />
          </div>
          <div className="flex items-center justify-between border-t-3 border-line pt-3">
            <span className="text-[13px] text-ink-2">Services</span>
            <span className="font-mono text-sm font-bold text-ink">3 up</span>
          </div>
          <Into label="Open System" />
        </section>
      </div>
    </div>
  );
}

/** O3 — the console. One grid, twelve cells, no sentence anywhere. */
function Cell({
  label,
  value,
  note,
}: {
  readonly label: string;
  readonly value: string;
  readonly note?: string;
}) {
  return (
    <div className="flex flex-col gap-1 border-3 border-line bg-surface px-3 py-2.5">
      <span className="truncate font-mono text-[9px] tracking-[0.12em] text-muted uppercase">
        {label}
      </span>
      <span className="font-mono text-xl leading-none font-bold text-ink">{value}</span>
      <span className="truncate font-mono text-[10px] text-muted">{note ?? ' '}</span>
    </div>
  );
}

export function Console() {
  return (
    <div className={`${CARD} flex flex-col gap-3 p-4`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Health services={SAMPLE.health.services} sameCommit={SAMPLE.health.sameCommit} />
        <span className="font-mono text-[11px] text-muted">
          {SAMPLE.range.from} → {SAMPLE.range.to}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
        <Cell label="Accounts" value={count(SAMPLE.players.accounts)} note="+96" />
        <Cell label="Guests" value={count(SAMPLE.players.guests)} />
        <Cell label="Ever played" value={count(SAMPLE.players.everPlayed)} note="74 %" />
        <Cell label="Active today" value={count(SAMPLE.players.activeToday)} />
        <Cell label="Active / week" value={count(SAMPLE.players.activeThisWeek)} />
        <Cell label="Active / range" value={count(SAMPLE.players.activeInRange)} />

        <Cell label="Landing" value={count(SAMPLE.traffic.landing)} />
        <Cell label="Entry" value={count(SAMPLE.traffic.entry)} />
        <Cell label="Reach" value={percent(SAMPLE.traffic.reach)} />
        <Cell label="Activation" value={percent(SAMPLE.activation.activation)} />
        <Cell label="Return" value={percent(SAMPLE.activation.returnRate)} />
        <Cell label="Abandon" value={percent(SAMPLE.games.abandonRate)} />

        <Cell label="Rounds" value={count(SAMPLE.games.rounds)} note="12 open" />
        <Cell label="Solo" value={count(SAMPLE.games.solo)} />
        <Cell label="Rooms" value={count(SAMPLE.games.multiplayer)} />
        <Cell label="Generated" value={count(SAMPLE.content.generated)} />
        <Cell label="Cache" value={percent(SAMPLE.content.cacheHitRate)} />
        <Cell label="Articles" value={count(SAMPLE.content.distinctTopics)} />

        <Cell label="Spend" value={euros(SAMPLE.cost.spend)} />
        <Cell label="Per round" value={euros(SAMPLE.cost.perGame, 4)} />
        <Cell label="Per player" value={euros(SAMPLE.cost.perPlayer, 3)} />
        <Cell label="Tokens / round" value={count(SAMPLE.cost.tokensPerGame)} />
        <Cell label="Created" value={String(SAMPLE.activation.steps[0]?.count ?? 0)} />
        <Cell label="Finished" value={String(SAMPLE.activation.steps[2]?.count ?? 0)} />
      </div>

      <div className={`${PANEL} flex flex-col gap-2 p-3`}>
        <span className={LABEL}>Landing views, by day</span>
        <Sparkline days={SAMPLE.traffic.days} height="h-28" />
      </div>
    </div>
  );
}
