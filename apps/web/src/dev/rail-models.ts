// The three navigations being compared — a scratch route, not a product one.
//
// Only the *shape* of the navigation varies here: how many pages there are,
// what they are called, and how they are grouped. What each page would contain
// is deliberately out of scope, and the lab renders a stub body saying so.
//
// The labels are English because everything in this repository is, including
// the interface (`CLAUDE.md`). The ones that already exist are the English
// catalogue's own words for the seven sections — `messages/en/admin.json` — so
// that what is being judged is the structure rather than a fresh translation.

/** The icons the lab draws. One name per glyph in `rail-icon.tsx`. */
export type IconName =
  'grid' | 'pulse' | 'users' | 'funnel' | 'cards' | 'bars' | 'coin' | 'document';

export interface Item {
  readonly id: string;
  readonly label: string;
  /** The address this entry would own. */
  readonly route: string;
  readonly icon: IconName;
  /**
   * The second level, for a model that merges sections into one page.
   *
   * Empty for the models that give every section its own address — which is
   * the whole difference between model C and the other two.
   */
  readonly tabs?: readonly string[];
}

export interface Group {
  readonly id: string;
  /** `null` for a group that is a plain run of entries with no heading. */
  readonly heading: string | null;
  readonly items: readonly Item[];
}

export interface Model {
  readonly id: 'flat' | 'grouped' | 'merged';
  readonly name: string;
  /** One sentence: what this model is betting on. */
  readonly bet: string;
  /** One sentence: what it costs. Stated so the comparison is not rigged. */
  readonly cost: string;
  readonly groups: readonly Group[];
}

const OVERVIEW: Item = {
  id: 'overview',
  label: 'Overview',
  route: '/admin',
  icon: 'grid',
};

const HEALTH: Item = {
  id: 'health',
  label: 'Health',
  route: '/admin/health',
  icon: 'pulse',
};
const PLAYERS: Item = {
  id: 'players',
  label: 'Players',
  route: '/admin/players',
  icon: 'users',
};
const ACTIVATION: Item = {
  id: 'activation',
  label: 'Activation',
  route: '/admin/activation',
  icon: 'funnel',
};
const ROUNDS: Item = {
  id: 'games',
  label: 'Rounds',
  route: '/admin/games',
  icon: 'cards',
};
const ARRIVALS: Item = {
  id: 'traffic',
  label: 'Arrivals',
  route: '/admin/traffic',
  icon: 'bars',
};
const COST: Item = { id: 'cost', label: 'Cost', route: '/admin/cost', icon: 'coin' };
const CONTENT: Item = {
  id: 'content',
  label: 'Content',
  route: '/admin/content',
  icon: 'document',
};

/**
 * A — one entry per section, in one flat run.
 *
 * The shape the panel already has, given an address each. Eight entries is
 * within what a person scans without reading, which is the argument for it.
 */
const FLAT: Model = {
  id: 'flat',
  name: 'A — flat',
  bet: 'Eight entries is few enough to scan without reading, so nothing needs a parent.',
  cost: 'Nothing says which entries answer the same question, so the order has to carry it alone.',
  groups: [
    {
      id: 'all',
      heading: null,
      items: [OVERVIEW, HEALTH, PLAYERS, ACTIVATION, ROUNDS, ARRIVALS, COST, CONTENT],
    },
  ],
};

/**
 * B — the same eight, under three headings.
 *
 * The count does not change; what changes is that the rail answers *what kind
 * of question is this* before it answers *which page*.
 */
const GROUPED: Model = {
  id: 'grouped',
  name: 'B — grouped',
  bet: 'The rail names the question before the page: who is playing, what is being played, what it costs to run.',
  cost: 'Three headings and a collapse are chrome eight entries may not need.',
  groups: [
    { id: 'top', heading: null, items: [OVERVIEW] },
    { id: 'audience', heading: 'Audience', items: [ARRIVALS, PLAYERS, ACTIVATION] },
    { id: 'game', heading: 'The game', items: [ROUNDS, CONTENT] },
    { id: 'system', heading: 'System', items: [COST, HEALTH] },
  ],
};

/**
 * C — four pages, each with a second level.
 *
 * The bet is that seven sections were never seven *pages*: three of them answer
 * one question between them, and a tab strip is cheaper to cross than a rail.
 */
const MERGED: Model = {
  id: 'merged',
  name: 'C — merged',
  bet: 'Four addresses instead of eight: sections that answer one question share a page and a tab strip.',
  cost: 'A tab strip is a second navigation, and a bookmark now has to carry which tab.',
  groups: [
    {
      id: 'all',
      heading: null,
      items: [
        OVERVIEW,
        {
          id: 'audience',
          label: 'Audience',
          route: '/admin/audience',
          icon: 'users',
          tabs: ['Arrivals', 'Players', 'Activation'],
        },
        {
          id: 'game',
          label: 'The game',
          route: '/admin/game',
          icon: 'cards',
          tabs: ['Rounds', 'Content'],
        },
        {
          id: 'system',
          label: 'System',
          route: '/admin/system',
          icon: 'pulse',
          tabs: ['Cost', 'Health'],
        },
      ],
    },
  ],
};

export const MODELS: readonly Model[] = [FLAT, GROUPED, MERGED];

/** Every entry of a model, in rail order — what a keyboard would walk. */
export function itemsOf(model: Model): readonly Item[] {
  return model.groups.flatMap((group) => group.items);
}
