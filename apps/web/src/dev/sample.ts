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
