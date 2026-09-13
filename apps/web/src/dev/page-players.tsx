// Three Players pages, one set of figures.
//
// Players answers two questions that are not the same question — *how many are
// there* and *who are they* — and the six counts answer the first while the
// most-active list answers the second. These three differ on which of the two
// they treat as the page.
//
// One constraint they all obey, because it is a promise and not a preference:
// the list shows a **pseudonym, never an address** (E.3.3). And the list is
// cumulative — the period chooses nothing about it — so every layout says so
// where the list is, not in a footnote.
import { count, percent, SAMPLE, type Player } from './sample-data.js';
import { CARD, Figure, LABEL, PANEL, Sparkline, Tile } from './parts.js';

export type PlayersLayoutId = 'digest' | 'halves' | 'roster';

export interface PlayersLayout {
  readonly id: PlayersLayoutId;
  readonly name: string;
  readonly bet: string;
  readonly cost: string;
}

export const PLAYERS_LAYOUTS: readonly PlayersLayout[] = [
  {
    id: 'digest',
    name: 'P1 — digest',
    bet: 'The shape Overview already has: four figures, then the list. Two pages that look alike are two pages nobody has to learn twice.',
    cost: 'The counts get the top of the page every time, even though the list is the only thing here you cannot get from Overview.',
  },
  {
    id: 'halves',
    name: 'P2 — two halves',
    bet: 'The page carries two questions, so it is drawn as two: how many there are on the left, drawn as a funnel of one population narrowing, and who they are on the right.',
    cost: 'Neither half gets full width, and the narrowing bars are a chart where four plain numbers would have done.',
  },
  {
    id: 'roster',
    name: 'P3 — roster first',
    bet: 'The list is the page. The counts fold into one strip above it, and every row gets a bar, so the shape of the tail is visible rather than inferred from a column of numbers.',
    cost: 'Six counts in one thin strip is six counts nobody reads, and a bar per row is ink spent on a ranking the order already gives.',
  },
];

/** The list, at two densities. `bars` draws each player's volume. */
function Roster({
  players,
  bars = false,
}: {
  readonly players: readonly Player[];
  readonly bars?: boolean;
}) {
  const top = players[0]?.gamesFinished ?? 1;
  return (
    <div className="flex flex-col">
      <div className="grid grid-cols-[1.7rem_minmax(0,1fr)_4.5rem_4.5rem_4rem] items-center gap-3 border-b-3 border-line-strong pb-2">
        <span className={LABEL}>#</span>
        <span className={LABEL}>Player</span>
        <span className={`${LABEL} text-right`}>Finished</span>
        <span className={`${LABEL} text-right`}>Started</span>
        <span className={`${LABEL} text-right`}>Seen</span>
      </div>
      {players.map((player, at) => (
        <div
          key={player.displayName}
          className="grid grid-cols-[1.7rem_minmax(0,1fr)_4.5rem_4.5rem_4rem] items-center gap-3 border-b-1 border-line py-2.5 last:border-b-0"
        >
          <span className="font-mono text-xs font-bold text-ink">{at + 1}</span>
          <span className="flex min-w-0 flex-col gap-1">
            <span className="truncate text-[13.5px] font-medium text-ink">
              {player.displayName}
            </span>
            {bars ? (
              <span className="flex h-1.5 w-full">
                <span
                  className="h-full bg-accent"
                  style={{
                    width: `${String(Math.round((player.gamesFinished / top) * 100))}%`,
                  }}
                />
              </span>
            ) : null}
          </span>
          <span className="text-right font-mono text-[13px] font-bold text-ink">
            {player.gamesFinished}
          </span>
          <span className="text-right font-mono text-[13px] text-muted">
            {player.gamesPlayed}
          </span>
          <span className="text-right font-mono text-xs text-muted">
            {player.lastSeen}
          </span>
        </div>
      ))}
    </div>
  );
}

/** The sentence the list needs wherever it appears. */
function Cumulative() {
  return (
    <p className="m-0 text-[11.5px] leading-relaxed text-muted">
      Cumulative totals with no date: the period above does not move this list.
    </p>
  );
}

/** P1 — the shape Overview has. Four figures, then the list. */
export function PlayersDigest() {
  const { players } = SAMPLE;
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tile
          label="Accounts"
          value={count(players.accounts)}
          note={`${count(players.guests)} guests besides`}
        />
        <Tile
          label="Ever played"
          value={count(players.everPlayed)}
          note={`${percent(players.everPlayed / players.accounts)} of accounts`}
        />
        <Tile
          label="Active today"
          value={count(players.activeToday)}
          note={`${count(players.activeThisWeek)} this week`}
        />
        <Tile
          label="Active this month"
          value={count(players.activeInRange)}
          note={`${percent(players.activeInRange / players.accounts)} of accounts`}
          filled
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <section className={`${CARD} flex flex-col gap-3 p-5`}>
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="m-0 text-lg font-bold text-ink">Most active</h2>
            <Cumulative />
          </div>
          <Roster players={players.mostActive} />
        </section>

        <section className={`${CARD} flex flex-col gap-4 p-5`}>
          <h2 className="m-0 text-lg font-bold text-ink">New accounts</h2>
          <Sparkline days={players.newPerDay} height="h-32" />
          <div className="flex items-center justify-between border-t-3 border-line pt-3">
            <span className="text-[13px] text-ink-2">This month</span>
            <span className="font-mono text-sm font-bold text-ink">
              + {String(players.newPerDay.reduce((total, day) => total + day, 0))}
            </span>
          </div>
        </section>
      </div>
    </div>
  );
}

/** One step of the narrowing, in P2. */
function Step({
  label,
  value,
  share,
  note,
  fill,
}: {
  readonly label: string;
  readonly value: number;
  readonly share: number;
  readonly note: string;
  readonly fill: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className={LABEL}>{label}</span>
        <span className="font-mono text-lg font-bold text-ink">{count(value)}</span>
      </div>
      <div
        className={`h-8 border-3 border-line-strong ${fill}`}
        style={{ width: `${String(Math.max(10, share * 100))}%` }}
      />
      <span className="text-[11.5px] text-muted">{note}</span>
    </div>
  );
}

/** P2 — two questions, two halves. */
export function PlayersHalves() {
  const { players } = SAMPLE;
  const whole = players.accounts;
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1.35fr]">
      <section className={`${CARD} flex flex-col gap-5 p-5`}>
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="m-0 text-lg font-bold text-ink">How many</h2>
          <span className="font-mono text-[11px] text-muted">of {count(whole)}</span>
        </div>

        <Step
          label="Accounts"
          value={players.accounts}
          share={1}
          note={`${count(players.guests)} guests play without one`}
          fill="bg-accent"
        />
        <Step
          label="Ever played"
          value={players.everPlayed}
          share={players.everPlayed / whole}
          note={`${count(players.accounts - players.everPlayed)} signed up and never started`}
          fill="bg-accent-soft"
        />
        <Step
          label="Active this month"
          value={players.activeInRange}
          share={players.activeInRange / whole}
          note="at least one round in the period"
          fill="bg-accent-soft"
        />
        <Step
          label="Active today"
          value={players.activeToday}
          share={players.activeToday / whole}
          note={`${count(players.activeThisWeek)} over the week`}
          fill="bg-bronze"
        />
      </section>

      <section className={`${CARD} flex flex-col gap-3 p-5`}>
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="m-0 text-lg font-bold text-ink">Who</h2>
          <Cumulative />
        </div>
        <Roster players={players.mostActive} />
      </section>
    </div>
  );
}

/** P3 — the list is the page. */
export function PlayersRoster() {
  const { players } = SAMPLE;
  return (
    <div className="flex flex-col gap-4">
      <section
        className={`${PANEL} grid gap-x-6 gap-y-4 p-4 sm:grid-cols-3 xl:grid-cols-6`}
      >
        <Figure label="Accounts" value={count(players.accounts)} />
        <Figure label="Guests" value={count(players.guests)} />
        <Figure
          label="Ever played"
          value={count(players.everPlayed)}
          note={percent(players.everPlayed / players.accounts)}
        />
        <Figure label="Active today" value={count(players.activeToday)} />
        <Figure label="This week" value={count(players.activeThisWeek)} />
        <Figure label="This month" value={count(players.activeInRange)} />
      </section>

      <section className={`${CARD} flex flex-col gap-3 p-5`}>
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          <h2 className="m-0 text-xl font-bold text-ink">Most active</h2>
          <Cumulative />
        </div>
        <Roster players={players.mostActive} bars />
        <p className="m-0 border-t-3 border-line pt-3 text-[11.5px] text-muted">
          Ten names, and that is the whole list — a sample, not a board. The board players
          see is its own page.
        </p>
      </section>
    </div>
  );
}
