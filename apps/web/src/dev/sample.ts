import article from './article.json' with { type: 'json' };

// The figures the dashboards are drawn with — step L.1, round four.
//
// **Sample data, and every field exists in a reader today.** `player_stats`
// carries the streak and the averages, `quest_assignment` the daily lot,
// `selectBoard` the ranking, and `game` the rounds played. Nothing drawn here
// is a number the home page would have to learn to compute.
//
// A dashboard judged on zeroes is a dashboard nobody can judge — which is why
// these are plausible rather than round.

export interface Round {
  /** The article, in French: the game reads fr.wikipedia.org. */
  readonly topic: string;
  readonly score: number;
  readonly found: number;
  readonly total: number;
  readonly when: string;
}

export interface Ranked {
  readonly place: number;
  readonly name: string;
  readonly rounds: number;
  readonly you?: boolean;
}

export const SAMPLE = {
  streak: 4,
  coins: 152,
  gamesFinished: 38,
  averageScore: 71,
  bestScore: 96,
  daily: { done: 3, target: 5, reward: 25 },
  weekly: { done: 11, target: 20, reward: 120 },
  rounds: [
    { topic: 'Tour Eiffel', score: 82, found: 3, total: 4, when: '2 h' },
    { topic: 'Volcan', score: 71, found: 2, total: 3, when: '5 h' },
    { topic: 'Napoléon Ier', score: 64, found: 2, total: 4, when: '1 j' },
    { topic: 'Photosynthèse', score: 93, found: 4, total: 4, when: '2 j' },
    { topic: 'Marie Curie', score: 55, found: 1, total: 3, when: '3 j' },
  ] as readonly Round[],
  board: [
    { place: 1, name: 'Cassiopée', rounds: 184 },
    { place: 2, name: 'Aristide', rounds: 167 },
    { place: 3, name: 'Pivoine', rounds: 142 },
    { place: 7, name: 'Théodule', rounds: 38, you: true },
  ] as readonly Ranked[],
  /** Seven days of rounds played, oldest first. */
  week: [2, 0, 5, 3, 1, 4, 6] as readonly number[],
};

export interface Item {
  /** The catalogue key under `shop.names`. */
  readonly id: string;
  readonly price: number;
  readonly owned: boolean;
  readonly worn: boolean;
  /** A swatch, for the slots where the item is a colour. */
  readonly swatch?: string;
}

export interface Slot {
  /** The catalogue key under `shop.slots` and `shop.slotLead`. */
  readonly id: 'marker' | 'markStyle' | 'frame';
  readonly items: readonly Item[];
}

/** The shop as a signed-in player sees it: three slots, ten items, one worn. */
export const SHOP: readonly Slot[] = [
  {
    id: 'marker',
    items: [
      { id: 'MARKER_CRIMSON', price: 120, owned: true, worn: true, swatch: '#C0362B' },
      { id: 'MARKER_AMBER', price: 120, owned: false, worn: false, swatch: '#D98324' },
      { id: 'MARKER_VIOLET', price: 200, owned: false, worn: false, swatch: '#6D51C7' },
      { id: 'MARKER_SLATE', price: 80, owned: true, worn: false, swatch: '#5A6B7A' },
    ],
  },
  {
    id: 'markStyle',
    items: [
      { id: 'MARK_STYLE_UNDERLINE', price: 150, owned: false, worn: false },
      { id: 'MARK_STYLE_BRACKET', price: 150, owned: false, worn: false },
      { id: 'MARK_STYLE_CORNER', price: 300, owned: false, worn: false },
    ],
  },
  {
    id: 'frame',
    items: [
      { id: 'FRAME_HAIRLINE', price: 90, owned: true, worn: false },
      { id: 'FRAME_DOUBLE', price: 220, owned: false, worn: false },
      { id: 'FRAME_NOTCHED', price: 400, owned: false, worn: false },
    ],
  },
];

export interface Quest {
  /** The catalogue key under `quests.rules`. */
  readonly rule: string;
  readonly target: number;
  readonly done: number;
  readonly reward: number;
  readonly claimed: boolean;
}

/** A day's lot and a week's, as `quest_assignment` hands them over. */
export const QUESTS = {
  daily: [
    { rule: 'DAILY_FINISH_ROUNDS', target: 3, done: 3, reward: 25, claimed: false },
    { rule: 'DAILY_FIND_FALSIFICATIONS', target: 8, done: 5, reward: 30, claimed: false },
    { rule: 'DAILY_UNAIDED_ROUND', target: 1, done: 1, reward: 20, claimed: true },
  ] as readonly Quest[],
  weekly: [
    { rule: 'WEEKLY_FINISH_ROUNDS', target: 20, done: 11, reward: 120, claimed: false },
    {
      rule: 'WEEKLY_FIND_FALSIFICATIONS',
      target: 50,
      done: 34,
      reward: 150,
      claimed: false,
    },
  ] as readonly Quest[],
};

export interface BoardRow {
  readonly rank: number;
  readonly name: string;
  readonly score: number;
  readonly when: string;
  readonly you?: boolean;
}

/** One board, as `selectBoard` hands it over: ranked, with the reader in it. */
export const BOARD: readonly BoardRow[] = [
  { rank: 1, name: 'Cassiopée', score: 4820, when: '2 h' },
  { rank: 2, name: 'Aristide', score: 4515, when: '1 j' },
  { rank: 3, name: 'Pivoine', score: 4390, when: '3 h' },
  { rank: 4, name: 'Ortolan', score: 3980, when: '5 h' },
  { rank: 5, name: 'Ficelle', score: 3745, when: '2 j' },
  { rank: 6, name: 'Belle de nuit', score: 3610, when: '1 j' },
  { rank: 7, name: 'Théodule', score: 3402, when: '2 h', you: true },
  { rank: 8, name: 'Grande Ourse', score: 3155, when: '4 j' },
];

/** The admin panel's own figures — every one of them from a reader track I built. */
export const ADMIN = {
  sections: [
    { key: 'traffic.title', route: '/admin/traffic' },
    { key: 'players.title', route: '/admin/players' },
    { key: 'activation.title', route: '/admin/activation' },
    { key: 'games.title', route: '/admin/games' },
    { key: 'content.title', route: '/admin/content' },
    { key: 'cost.title', route: '/admin/cost' },
    { key: 'health.title', route: '/admin/health' },
  ],
  accounts: 1284,
  activeToday: 73,
  activeThisWeek: 312,
  rounds: 2941,
  soloShare: 0.64,
  spend: 4.17,
  perRound: 0.0081,
  activation: 0.59,
  returnRate: 0.47,
  funnel: [
    { step: 'created', count: 96 },
    { step: 'started', count: 75 },
    { step: 'finished', count: 57 },
    { step: 'returned', count: 27 },
  ],
  services: [
    { name: 'web', up: true, ms: 0 },
    { name: 'realtime', up: true, ms: 84 },
    { name: 'database', up: true, ms: 12 },
  ],
};

export interface Paragraph {
  readonly text: string;
  readonly marked: boolean;
}

/**
 * A round in progress, on a real article.
 *
 * **The prose lives in `article.json` and not here**, and that is not tidiness.
 * `language.test.ts` refuses French in the sources, and it is right to: it
 * cannot tell interface copy from an encyclopaedia. The repository already has
 * the distinction — the game reads fr.wikipedia.org, and *that is data, not our
 * prose* — so the data goes in a data file and the scan keeps its teeth.
 *
 * One of these paragraphs has had a fact moved, and the mockup deliberately
 * does not say which: nothing on that screen knows, which is what
 * `brief.serverGradesNote` promises the player.
 */
export const ROUND = {
  topic: article.topic,
  total: 4,
  altered: 2,
  secondsLeft: 134,
  hintsLeft: 2,
  paragraphs: article.paragraphs as readonly Paragraph[],
};
