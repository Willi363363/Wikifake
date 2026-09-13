// The figures the lab is drawn with — Overview, Players, and the six to come.
//
// **Sample data, and the lab says so on screen.** Real numbers would need a
// database and a session, and this route has neither by design — but a layout
// judged on `0` everywhere is a layout nobody can judge, so the shapes are
// plausible: a month-old game with a few hundred players.
//
// One object for all three layouts, deliberately. Three sets of numbers would
// make them look different when only their arrangement differs.
//
// Every field below exists in a reader today — `readPlayers`, `readActivation`,
// `readGames`, `readTraffic`, `readCost`, `readContent`, `readHealth` — so
// nothing here is a figure the panel would have to learn how to compute.

export interface FunnelStep {
  readonly name: string;
  readonly count: number;
  /** Share of the step above. `null` for the first. */
  readonly ofPrevious: number | null;
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

export const SAMPLE = {
  range: { label: 'This month', from: '15 August', to: '13 September 2026' },

  players: {
    accounts: 1284,
    guests: 412,
    everPlayed: 948,
    activeToday: 73,
    activeThisWeek: 312,
    activeInRange: 596,
    /**
     * New accounts per day over the range, oldest first.
     *
     * Sums to the funnel's `created` deliberately: two fields of one sample
     * that disagree are a mockup arguing with itself, and somebody will read a
     * meaning into the gap.
     */
    newPerDay: [4, 7, 5, 9, 6, 8, 10, 7, 11, 9, 12, 8] as readonly number[],
    /**
     * The ten names the panel shows — `selectMostActive`, ordered by rounds
     * finished. Cumulative totals with no date: the period does not move them,
     * and every layout below has to say so.
     */
    mostActive: [
      { displayName: 'Cassiopée', gamesFinished: 184, gamesPlayed: 201, lastSeen: '2 h' },
      {
        displayName: 'Marmotte du Vercors',
        gamesFinished: 167,
        gamesPlayed: 179,
        lastSeen: '5 h',
      },
      { displayName: 'Aristide', gamesFinished: 142, gamesPlayed: 158, lastSeen: '1 d' },
      { displayName: 'Pivoine', gamesFinished: 118, gamesPlayed: 140, lastSeen: '1 d' },
      {
        displayName: 'Grande Ourse',
        gamesFinished: 97,
        gamesPlayed: 103,
        lastSeen: '3 d',
      },
      { displayName: 'Théodule', gamesFinished: 91, gamesPlayed: 112, lastSeen: '3 d' },
      {
        displayName: 'Belle de nuit',
        gamesFinished: 84,
        gamesPlayed: 90,
        lastSeen: '6 d',
      },
      { displayName: 'Ortolan', gamesFinished: 76, gamesPlayed: 95, lastSeen: '6 d' },
      { displayName: 'Ficelle', gamesFinished: 71, gamesPlayed: 78, lastSeen: '8 d' },
      {
        displayName: 'Vent d\u2019autan',
        gamesFinished: 64,
        gamesPlayed: 88,
        lastSeen: '12 d',
      },
    ] as readonly Player[],
  },

  activation: {
    steps: [
      { name: 'Created', count: 96, ofPrevious: null },
      { name: 'Started', count: 75, ofPrevious: 0.78 },
      { name: 'Finished', count: 57, ofPrevious: 0.76 },
      { name: 'Returned', count: 27, ofPrevious: 0.47 },
    ] as readonly FunnelStep[],
    activation: 0.59,
    returnRate: 0.47,
  },

  games: {
    rounds: 2941,
    solo: 1882,
    multiplayer: 1059,
    open: 12,
    abandonRate: 0.18,
  },

  traffic: {
    landing: 1902,
    entry: 781,
    reach: 0.41,
    /** Landing views per day, oldest first. Twelve days, for a sparkline. */
    days: [38, 52, 44, 67, 58, 81, 73, 62, 88, 76, 94, 100] as readonly number[],
  },

  cost: {
    spend: 4.17,
    perGame: 0.0041,
    perPlayer: 0.013,
    tokensPerGame: 7412,
  },

  content: {
    generated: 1024,
    cacheHitRate: 0.65,
    distinctTopics: 268,
    topTopic: 'Chat',
  },

  health: {
    services: [
      { name: 'Web', up: true, ms: 0 },
      { name: 'Realtime', up: true, ms: 84 },
      { name: 'Database', up: true, ms: 12 },
    ] as readonly Service[],
    sameCommit: true,
  },
} as const;

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
