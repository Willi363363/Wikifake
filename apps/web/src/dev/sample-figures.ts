// The shapes a row has, and the fixtures the lab is drawn from.
//
// Split out of `sample-data.ts` when it passed the 500-line cap: this file is
// *what the figures are*, and that one is *what a period does to them*.
//
// Every interface below mirrors a type a reader returns today — `ActivePlayer`,
// `ModeRow`, `KindUsage`, `TopicCount`, `Funnel` — so nothing drawn in the lab
// is a shape the panel would have to learn.

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

/**
 * One mode's rounds and seats — `ModeRow`, field for field.
 *
 * **Seats and rounds are not the same count**, and the page falls apart if
 * they are conflated: a solo round has one seat, a room has as many as it had
 * players, and the abandon rate is a share of *seats* in *finished* rounds.
 */
export interface Mode {
  readonly mode: string;
  readonly rounds: number;
  readonly ended: number;
  readonly open: number;
  readonly seats: number;
  readonly submitted: number;
  readonly abandoned: number;
  readonly abandonRate: number;
}

/** One kind of model call — `KindUsage`, field for field. */
export interface Kind {
  readonly kind: string;
  readonly calls: number;
  readonly failed: number;
  readonly inputTokens: number;
  readonly outputTokens: number;
  /** What those tokens cost, at the configured rate. */
  readonly spend: number;
}

/** One article, and how often it was already in the cache — `TopicCount`. */
export interface Topic {
  readonly topic: string;
  readonly games: number;
  readonly fromCache: number;
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

/** The figures at one month, before the period scales them. */
export const BASE = {
  players: { accounts: 1284, guests: 412, everPlayed: 948, activeInRange: 596 },
  activation: { created: 96, started: 75, finished: 57, returned: 27 },
  games: {
    rounds: 2941,
    solo: 1882,
    multiplayer: 1059,
    open: 12,
    // Seats, not rounds: a solo round has one, a room has as many as it had
    // players. The two columns are different questions wearing one table.
    soloSeats: 1874,
    soloSubmitted: 1553,
    roomSeats: 3241,
    roomSubmitted: 2612,
  },
  traffic: { landing: 1902, entry: 781 },
  cost: { spend: 4.17, tokensPerGame: 7412 },
  content: { generated: 1024, distinctTopics: 268 },
};

/** A curve with a shape, stretched to however many columns the period wants. */
export function series(buckets: number, top: number): readonly number[] {
  const shape = [0.38, 0.52, 0.44, 0.67, 0.58, 0.81, 0.73, 0.62, 0.88, 0.76, 0.94, 1];
  return Array.from({ length: buckets }, (_, at) => {
    const from = shape[Math.round((at / Math.max(1, buckets - 1)) * (shape.length - 1))];
    return Math.max(1, Math.round((from ?? 1) * top));
  });
}

/**
 * Euros per million tokens for `gemini-3.1-flash-lite`.
 *
 * $0.25 in and $1.50 out on Google's published paid tier, at 0.861 USD→EUR on
 * 13 September 2026. The panel reads these from
 * `MODEL_INPUT_COST_PER_MTOK` and `MODEL_OUTPUT_COST_PER_MTOK` rather than
 * from source — a rate written into a repository is wrong within a quarter and
 * silent about it — so these two constants exist for the mockup alone.
 */
export const INPUT_RATE = 0.215;
export const OUTPUT_RATE = 1.29;

/** One kind of call, priced at the configured rate. */
export function kindOf(
  kind: string,
  calls: number,
  failed: number,
  inputTokens: number,
  outputTokens: number,
): Kind {
  return {
    kind,
    calls,
    failed,
    inputTokens,
    outputTokens,
    spend: (inputTokens * INPUT_RATE + outputTokens * OUTPUT_RATE) / 1_000_000,
  };
}

/** The articles played most. French, because the game reads fr.wikipedia.org. */
export const TOPICS: readonly Topic[] = [
  { topic: 'Chat', games: 71, fromCache: 58 },
  { topic: 'Napoléon Ier', games: 64, fromCache: 49 },
  { topic: 'Tour Eiffel', games: 58, fromCache: 47 },
  { topic: 'Photosynthèse', games: 46, fromCache: 33 },
  { topic: 'Marie Curie', games: 41, fromCache: 31 },
  { topic: 'Volcan', games: 37, fromCache: 24 },
  { topic: 'Jeux olympiques', games: 33, fromCache: 22 },
  { topic: 'Loup gris', games: 28, fromCache: 17 },
];

/** A mode's row, with the two counts the rate is a share of. */
export function modeOf(
  mode: string,
  rounds: number,
  open: number,
  seats: number,
  submitted: number,
): Mode {
  const abandoned = Math.max(0, seats - submitted);
  return {
    mode,
    rounds,
    ended: Math.max(0, rounds - open),
    open,
    seats,
    submitted,
    abandoned,
    abandonRate: seats === 0 ? 0 : abandoned / seats,
  };
}

export const WHY: readonly { readonly why: string; readonly lost: string }[] = [
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

/** Cumulative, dateless, and the same whatever the period says. */
export const MOST_ACTIVE: readonly Player[] = [
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
