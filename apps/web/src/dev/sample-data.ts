// The figures the lab is drawn with, and the period that moves them.
//
// **Sample data, and the lab says so on screen.** Real numbers need a database
// and a session, and this route has neither by design — but a layout judged on
// `0` everywhere is a layout nobody can judge.
//
// Every field below exists in a reader today — `readPlayers`, `readActivation`,
// `readGames`, `readTraffic`, `readCost`, `readContent`, `readHealth` — so
// nothing drawn here is a figure the panel would have to learn to compute.
//
// **What the period moves, and what it does not, is not a detail.** Three of
// these figures are deliberately immune to it, and each one is immune for its
// own reason, read off the readers rather than guessed:
//
//   - `activeToday` and `activeThisWeek` are `countActiveSince` over *today*
//     and *this week*, never over the range. Picking "this year" does not make
//     "active today" mean a year.
//   - `mostActive` is `selectMostActive` with no window at all: cumulative
//     totals with no date.
//   - `health` is a live probe. A probe has no history to filter.
//
// A selector that silently moved them would be lying, so `sampleFor` leaves
// them alone and every layout that shows one says why where it shows it.

export interface FunnelStep {
  readonly name: string;
  readonly count: number;
  /** Share of the step above. `null` for the first. */
  readonly ofPrevious: number | null;
  /** Share of the first step. `null` for the first. */
  readonly ofCreated: number | null;
  /** What the step means, and what the gap above it is. */
  readonly why: string;
  /** The people the step above has and this one does not. */
  readonly lost: string;
}

export interface Service {
  readonly name: string;
  readonly up: boolean;
  readonly ms: number;
}

/**
 * A row of the most-active list — `ActivePlayer`, field for field.
 *
 * **A pseudonym, never an email**, which is E.3.3's promise and holds on a
 * mockup as firmly as on a screen: a layout drawn with addresses is a layout
 * somebody will build with addresses.
 */
export interface Player {
  readonly displayName: string;
  readonly gamesFinished: number;
  readonly gamesPlayed: number;
  readonly lastSeen: string;
}

export interface Period {
  readonly id: string;
  readonly label: string;
  /** How much of a month this period is, for the figures it moves. */
  readonly scale: number;
  /** The dates the header prints under the title. */
  readonly covering: string;
  /** How many columns a per-day chart gets. */
  readonly buckets: number;
}

export const PERIODS: readonly Period[] = [
  { id: '24h', label: '24 h', scale: 1 / 30, covering: '13 September 2026', buckets: 12 },
  {
    id: 'week',
    label: 'This week',
    scale: 7 / 30,
    covering: '7 → 13 September 2026',
    buckets: 7,
  },
  {
    id: 'month',
    label: 'This month',
    scale: 1,
    covering: '15 August → 13 September 2026',
    buckets: 12,
  },
  {
    id: 'year',
    label: 'This year',
    scale: 8.4,
    covering: '1 January → 13 September 2026',
    buckets: 12,
  },
  {
    id: 'all',
    label: 'All',
    scale: 11.2,
    covering: 'Everything since the first round',
    buckets: 12,
  },
  {
    id: 'custom',
    label: '1 Jun → 13 Sep',
    scale: 3.5,
    covering: '1 June → 13 September 2026, inclusive',
    buckets: 12,
  },
];

export const DEFAULT_PERIOD = PERIODS[2] as Period;

/** The figures at one month, before the period scales them. */
const BASE = {
  players: { accounts: 1284, guests: 412, everPlayed: 948, activeInRange: 596 },
  activation: { created: 96, started: 75, finished: 57, returned: 27 },
  games: { rounds: 2941, solo: 1882, multiplayer: 1059, open: 12 },
  traffic: { landing: 1902, entry: 781 },
  cost: { spend: 4.17, tokensPerGame: 7412 },
  content: { generated: 1024, distinctTopics: 268 },
};

/** A curve with a shape, stretched to however many columns the period wants. */
function series(buckets: number, top: number): readonly number[] {
  const shape = [0.38, 0.52, 0.44, 0.67, 0.58, 0.81, 0.73, 0.62, 0.88, 0.76, 0.94, 1];
  return Array.from({ length: buckets }, (_, at) => {
    const from = shape[Math.round((at / Math.max(1, buckets - 1)) * (shape.length - 1))];
    return Math.max(1, Math.round((from ?? 1) * top));
  });
}

const WHY: readonly { readonly why: string; readonly lost: string }[] = [
  {
    why: 'Signed up. Guests do not count: they are not accounts.',
    lost: '',
  },
  {
    why: 'Pressed play at least once.',
    lost: 'signed up and never started',
  },
  {
    why: 'Submitted at least one round.',
    lost: 'started a round and abandoned it',
  },
  {
    why: 'Active on a later day than the first. Two rounds in a row is not coming back.',
    lost: 'finished a round and never came back',
  },
];

export interface Sample {
  readonly period: Period;
  readonly players: {
    readonly accounts: number;
    readonly guests: number;
    readonly everPlayed: number;
    readonly activeInRange: number;
    /** Fixed windows. The period never moves these. */
    readonly activeToday: number;
    readonly activeThisWeek: number;
    readonly newPerDay: readonly number[];
    /** Cumulative, with no date. The period never moves this either. */
    readonly mostActive: readonly Player[];
  };
  readonly activation: {
    readonly steps: readonly FunnelStep[];
    readonly activation: number;
    readonly returnRate: number;
  };
  readonly games: {
    readonly rounds: number;
    readonly solo: number;
    readonly multiplayer: number;
    readonly open: number;
    readonly abandonRate: number;
  };
  readonly traffic: {
    readonly landing: number;
    readonly entry: number;
    readonly reach: number;
    readonly days: readonly number[];
    /** The entry screen, day by day, beside `days`. */
    readonly entryDays: readonly number[];
    /** The day the counter was switched on. Nothing exists before it. */
    readonly since: string;
    /**
     * Whether the chosen period reaches back past `since`.
     *
     * It matters because those days were not counted rather than empty: two
     * periods straddling that date are not comparable, and a chart that draws
     * zero there is drawing a measurement nobody took.
     */
    readonly beforeCounting: boolean;
  };
  readonly cost: {
    readonly spend: number;
    readonly perGame: number;
    readonly perPlayer: number;
    readonly tokensPerGame: number;
  };
  readonly content: {
    readonly generated: number;
    readonly cacheHitRate: number;
    readonly distinctTopics: number;
    readonly topTopic: string;
  };
  readonly health: {
    readonly services: readonly Service[];
    readonly sameCommit: boolean;
  };
}

/** Cumulative, dateless, and the same whatever the period says. */
const MOST_ACTIVE: readonly Player[] = [
  { displayName: 'Cassiopée', gamesFinished: 184, gamesPlayed: 201, lastSeen: '2 h' },
  {
    displayName: 'Marmotte du Vercors',
    gamesFinished: 167,
    gamesPlayed: 179,
    lastSeen: '5 h',
  },
  { displayName: 'Aristide', gamesFinished: 142, gamesPlayed: 158, lastSeen: '1 d' },
  { displayName: 'Pivoine', gamesFinished: 118, gamesPlayed: 140, lastSeen: '1 d' },
  { displayName: 'Grande Ourse', gamesFinished: 97, gamesPlayed: 103, lastSeen: '3 d' },
  { displayName: 'Théodule', gamesFinished: 91, gamesPlayed: 112, lastSeen: '3 d' },
  { displayName: 'Belle de nuit', gamesFinished: 84, gamesPlayed: 90, lastSeen: '6 d' },
  { displayName: 'Ortolan', gamesFinished: 76, gamesPlayed: 95, lastSeen: '6 d' },
  { displayName: 'Ficelle', gamesFinished: 71, gamesPlayed: 78, lastSeen: '8 d' },
  { displayName: 'Vent d’autan', gamesFinished: 64, gamesPlayed: 88, lastSeen: '12 d' },
];

/** Every figure the chosen period implies. The one thing the lab computes. */
export function sampleFor(period: Period): Sample {
  const at = (value: number) => Math.max(1, Math.round(value * period.scale));
  const created = at(BASE.activation.created);
  const started = at(BASE.activation.started);
  const finished = at(BASE.activation.finished);
  const returned = at(BASE.activation.returned);
  const counts = [created, started, finished, returned];
  const names = ['Created', 'Started', 'Finished', 'Returned'];

  const rounds = at(BASE.games.rounds);
  const landing = at(BASE.traffic.landing);
  const entry = at(BASE.traffic.entry);
  const spend = Number((BASE.cost.spend * period.scale).toFixed(2));
  const generated = at(BASE.content.generated);
  const activeInRange = at(BASE.players.activeInRange);
  const landingDays = series(period.buckets, Math.max(4, Math.round(landing / 12)));

  return {
    period,
    players: {
      accounts: at(BASE.players.accounts),
      guests: at(BASE.players.guests),
      everPlayed: at(BASE.players.everPlayed),
      activeInRange,
      activeToday: 73,
      activeThisWeek: 312,
      newPerDay: series(period.buckets, Math.max(2, Math.round(created / 8))),
      mostActive: MOST_ACTIVE,
    },
    activation: {
      steps: counts.map((count, step) => ({
        name: names[step] as string,
        count,
        ofPrevious: step === 0 ? null : count / (counts[step - 1] as number),
        ofCreated: step === 0 ? null : count / created,
        why: WHY[step]?.why ?? '',
        lost: WHY[step]?.lost ?? '',
      })),
      activation: finished / created,
      returnRate: returned / finished,
    },
    games: {
      rounds,
      solo: at(BASE.games.solo),
      multiplayer: at(BASE.games.multiplayer),
      open: BASE.games.open,
      abandonRate: 0.18,
    },
    traffic: {
      landing,
      entry,
      reach: entry / landing,
      days: landingDays,
      entryDays: landingDays.map((day) => Math.max(1, Math.round(day * 0.41))),
      since: '4 August 2026',
      beforeCounting: period.scale > 2,
    },
    cost: {
      spend,
      perGame: spend / generated,
      perPlayer: spend / Math.max(1, activeInRange),
      tokensPerGame: BASE.cost.tokensPerGame,
    },
    content: {
      generated,
      cacheHitRate: 0.65,
      distinctTopics: at(BASE.content.distinctTopics),
      topTopic: 'Chat',
    },
    health: {
      services: [
        { name: 'Web', up: true, ms: 0 },
        { name: 'Realtime', up: true, ms: 84 },
        { name: 'Database', up: true, ms: 12 },
      ],
      sameCommit: true,
    },
  };
}

/** A percentage, the way every admin screen already writes one. */
export function percent(share: number): string {
  return `${String(Math.round(share * 100))} %`;
}

/** A count with the thin spaces the interface uses for thousands. */
export function count(value: number): string {
  return value.toLocaleString('en-GB').replace(/,/g, ' ');
}

/** Euros, to the number of places the figure actually carries. */
export function euros(value: number, places = 2): string {
  return `€ ${value.toFixed(places)}`;
}
