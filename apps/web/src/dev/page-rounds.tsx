// Three Rounds pages, one set of figures.
//
// The page has one real subject and it is easy to miss: **rounds and seats are
// different counts**. A solo round has one seat; a room has as many as it had
// players. The abandon rate is a share of *seats*, in *finished* rounds only —
// a seat in a round still running has abandoned nothing.
//
// And it cannot be broken down by screen. Typing a topic, voting and waiting
// for the generation leave no row behind, so the only split the data supports
// is by mode. The three layouts differ on whether that split is the page, or
// the abandonment is.
import { count, percent, type Mode, type Sample } from './sample-data.js';
import { CARD, Figure, LABEL, PANEL, Sparkline, Tile } from './parts.js';

export type RoundsLayoutId = 'digest' | 'modes' | 'seats';

export interface RoundsLayout {
  readonly id: RoundsLayoutId;
  readonly name: string;
  readonly bet: string;
  readonly cost: string;
}

export const ROUNDS_LAYOUTS: readonly RoundsLayout[] = [
  {
    id: 'digest',
    name: 'G1 — digest',
    bet: 'The shape the panel now has: four figures, the rounds over time, and the one table the data supports.',
    cost: 'Rounds and seats sit in the same table under different headings, which is exactly where the two get conflated.',
  },
  {
    id: 'modes',
    name: 'G2 — two modes',
    bet: 'Solo and rooms are two different games wearing one name, so they get a card each and the comparison is the page.',
    cost: 'Two cards invite a comparison the numbers cannot settle — a room has more seats because it has more players, not because it is better.',
  },
  {
    id: 'seats',
    name: 'G3 — seats',
    bet: 'Abandonment is the only figure here anybody would act on, and it is about seats. So the page leads with the seat funnel and lets rounds be context.',
    cost: 'Somebody opening “Rounds” to count rounds has to read past a chart about something else first.',
  },
];

/** The sentence the table needs wherever the table appears. */
function SeatsNotRounds() {
  return (
    <p className="m-0 text-[11.5px] leading-relaxed text-muted">
      A <strong className="text-ink-2">seat</strong> is one player in one round: a solo
      round has one, a room has as many as it had players. Only finished rounds count
      towards the rate — a seat in a round still running has abandoned nothing. There is
      no split by screen: typing a topic, voting and waiting for the generation leave no
      row behind.
    </p>
  );
}

function ModeTable({
  rows,
  total,
}: {
  readonly rows: readonly Mode[];
  readonly total: Mode;
}) {
  const columns = 'grid grid-cols-[minmax(0,1fr)_4.5rem_4rem_5rem_5.5rem_4rem] gap-3';
  return (
    <div className="flex flex-col">
      <div className={`${columns} border-b-3 border-line-strong pb-2`}>
        <span className={LABEL}>Mode</span>
        <span className={`${LABEL} text-right`}>Rounds</span>
        <span className={`${LABEL} text-right`}>Open</span>
        <span className={`${LABEL} text-right`}>Seats</span>
        <span className={`${LABEL} text-right`}>Abandoned</span>
        <span className={`${LABEL} text-right`}>Rate</span>
      </div>
      {[...rows, total].map((row, at) => (
        <div
          key={row.mode}
          className={`${columns} border-b-1 border-line py-2.5 last:border-b-0 ${
            at === rows.length ? 'font-bold' : ''
          }`}
        >
          <span className="truncate text-[13.5px] text-ink">{row.mode}</span>
          <span className="text-right font-mono text-[13px] text-ink">
            {count(row.rounds)}
          </span>
          <span className="text-right font-mono text-[13px] text-muted">
            {count(row.open)}
          </span>
          <span className="text-right font-mono text-[13px] text-ink">
            {count(row.seats)}
          </span>
          <span className="text-right font-mono text-[13px] text-muted">
            {count(row.abandoned)}
          </span>
          <span className="text-right font-mono text-[13px] text-ink">
            {percent(row.abandonRate)}
          </span>
        </div>
      ))}
    </div>
  );
}

/** G1 — the house shape. */
export function RoundsDigest({ data }: { readonly data: Sample }) {
  const { games } = data;
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tile
          label="Rounds"
          value={count(games.rounds)}
          note={`${count(games.open)} still running`}
        />
        <Tile
          label="Solo"
          value={percent(games.solo / games.rounds)}
          note={`${count(games.solo)} rounds`}
        />
        <Tile
          label="Seats"
          value={count(games.total.seats)}
          note="one player in one round"
        />
        <Tile
          label="Abandoned"
          value={percent(games.total.abandonRate)}
          note={`${count(games.total.abandoned)} seats never submitted`}
          filled
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <section className={`${CARD} flex flex-col gap-4 p-5`}>
          <h2 className="m-0 text-lg font-bold text-ink">Rounds over the period</h2>
          <Sparkline days={games.perDay} height="h-40" />
          <div className="flex items-center justify-between border-t-3 border-line pt-3">
            <span className="text-[13px] text-ink-2">Today</span>
            <span className="font-mono text-sm font-bold text-ink">
              {count(games.perDay[games.perDay.length - 1] ?? 0)}
            </span>
          </div>
        </section>

        <section className={`${CARD} flex flex-col gap-3 p-5`}>
          <h2 className="m-0 text-lg font-bold text-ink">By mode</h2>
          <ModeTable rows={games.modes} total={games.total} />
          <div className="border-t-3 border-line pt-3">
            <SeatsNotRounds />
          </div>
        </section>
      </div>
    </div>
  );
}

/** One mode, given a card of its own, in G2. */
function ModeCard({ row, filled }: { readonly row: Mode; readonly filled: boolean }) {
  return (
    <section className={`${CARD} flex flex-col gap-4 p-5 ${filled ? 'bg-accent' : ''}`}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="m-0 text-xl font-bold text-ink">{row.mode}</h2>
        <span className="font-mono text-[11px] text-muted">
          {count(row.open)} still running
        </span>
      </div>

      <span className="text-4xl leading-none font-extrabold text-ink">
        {count(row.rounds)}
      </span>
      <span className={LABEL}>rounds</span>

      <div
        className={`grid grid-cols-2 gap-4 border-t-3 pt-4 ${
          filled ? 'border-line-strong' : 'border-line'
        }`}
      >
        <Figure
          label="Seats"
          value={count(row.seats)}
          note={`${count(row.submitted)} submitted`}
        />
        <Figure
          label="Abandoned"
          value={percent(row.abandonRate)}
          note={`${count(row.abandoned)} seats`}
        />
      </div>

      <div className="flex h-3 border-3 border-line-strong bg-bg">
        <span
          className="h-full bg-danger"
          style={{ width: `${String(Math.round(row.abandonRate * 100))}%` }}
        />
      </div>
    </section>
  );
}

/** G2 — two modes, two cards, and the comparison is the page. */
export function RoundsModes({ data }: { readonly data: Sample }) {
  const { games } = data;
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 lg:grid-cols-2">
        {games.modes.map((row, at) => (
          <ModeCard key={row.mode} row={row} filled={at === 0} />
        ))}
      </div>

      <section className={`${PANEL} flex flex-wrap items-center gap-x-10 gap-y-4 p-4`}>
        <span className={LABEL}>Both modes</span>
        <Figure label="Rounds" value={count(games.total.rounds)} />
        <Figure label="Seats" value={count(games.total.seats)} />
        <Figure label="Abandoned" value={percent(games.total.abandonRate)} />
      </section>

      <section className={`${CARD} flex flex-col gap-3 p-5`}>
        <SeatsNotRounds />
      </section>
    </div>
  );
}

/** G3 — the seat funnel first, rounds as context. */
export function RoundsSeats({ data }: { readonly data: Sample }) {
  const { games } = data;
  const { total } = games;
  return (
    <div className="flex flex-col gap-4">
      <section className={`${CARD} flex flex-col gap-5 p-6`}>
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          <h2 className="m-0 text-lg font-bold text-ink">Seats, in finished rounds</h2>
          <span className="font-mono text-[11px] text-muted">
            one player in one round
          </span>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-full items-center border-3 border-line-strong bg-accent px-4">
              <span className="text-sm font-bold text-ink">Seats taken</span>
            </div>
            <span className="w-20 shrink-0 text-right font-mono text-xl font-bold text-ink">
              {count(total.seats)}
            </span>
          </div>

          <div className="flex items-center gap-3 py-0.5 pl-4">
            <svg
              width="14"
              height="20"
              viewBox="0 0 14 22"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.4}
              strokeLinecap="square"
              className="text-muted"
              aria-hidden
            >
              <path d="M7 1v16M2 13l5 6 5-6" />
            </svg>
            <span className="text-[12.5px] text-muted">
              <strong className="text-ink">− {count(total.abandoned)}</strong> never
              submitted
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div
              className="flex h-12 items-center border-3 border-line-strong bg-green px-4"
              style={{ width: `${String(Math.round((1 - total.abandonRate) * 100))}%` }}
            >
              <span className="truncate text-sm font-bold text-ink">Submitted</span>
            </div>
            <span className="ml-auto w-20 shrink-0 text-right font-mono text-xl font-bold text-ink">
              {count(total.submitted)}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-baseline gap-x-3 border-t-3 border-line pt-4">
          <span className={LABEL}>Abandon rate</span>
          <span className="font-mono text-3xl font-extrabold text-ink">
            {percent(total.abandonRate)}
          </span>
          <span className="text-[12.5px] text-muted">
            and by mode:{' '}
            {games.modes
              .map((row) => `${row.mode} ${percent(row.abandonRate)}`)
              .join(' · ')}
          </span>
        </div>

        <SeatsNotRounds />
      </section>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <section className={`${PANEL} flex flex-col gap-3 p-4`}>
          <span className={LABEL}>Rounds over the period</span>
          <Sparkline days={games.perDay} height="h-28" />
        </section>

        <section className={`${PANEL} flex flex-col gap-3 p-4`}>
          <span className={LABEL}>By mode</span>
          <ModeTable rows={games.modes} total={games.total} />
        </section>
      </div>
    </div>
  );
}
