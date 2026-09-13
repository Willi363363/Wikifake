// The navigations being compared — a scratch route, not a product one.
//
// The grouping was chosen: eight sections under Audience, The game and System.
// What is still open is how loudly the rail *says* it, and that is the only
// axis these four models vary. The entries, their order and their names are
// identical in all four, so what is being judged is the expression rather than
// four different navigations wearing the same words.
//
// The labels are English because everything in this repository is, including
// the interface (`CLAUDE.md`). The seven that already exist are the English
// catalogue's own words — `messages/en/admin.json`.

/** The icons the lab draws. One name per glyph in `rail-icon.tsx`. */
export type IconName =
  'grid' | 'pulse' | 'users' | 'funnel' | 'cards' | 'bars' | 'coin' | 'document';

/**
 * How a model draws the grouping it shares with the other three.
 *
 * `headings` a heading over each run · `boxed` each group in its own bordered
 * block · `dividers` a rule between runs and no words at all · `two-level` a
 * column of group icons beside the pages of the group in hand.
 */
export type RailStyle = 'headings' | 'boxed' | 'dividers' | 'two-level';

export interface Item {
  readonly id: string;
  readonly label: string;
  /** The address this entry would own. */
  readonly route: string;
  readonly icon: IconName;
}

export interface Group {
  readonly id: string;
  /** `null` for the run that holds Overview: it is nobody's category. */
  readonly heading: string | null;
  /** What the two-level rail puts in its first column. */
  readonly icon: IconName;
  readonly items: readonly Item[];
}

export interface Model {
  readonly id: 'headings' | 'boxed' | 'dividers' | 'two-level';
  readonly name: string;
  readonly style: RailStyle;
  /** One sentence: what this model is betting on. */
  readonly bet: string;
  /** One sentence: what it costs. Stated so the comparison is not rigged. */
  readonly cost: string;
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
 * The grouping itself — shared by every model, and the thing that was chosen.
 *
 * Overview is in a run of its own rather than at the top of Audience: it is the
 * page about all three groups, so putting it inside one of them would be a
 * claim that is not true.
 */
export const GROUPS: readonly Group[] = [
  { id: 'top', heading: null, icon: 'grid', items: [OVERVIEW] },
  {
    id: 'audience',
    heading: 'Audience',
    icon: 'users',
    items: [ARRIVALS, PLAYERS, ACTIVATION],
  },
  { id: 'game', heading: 'The game', icon: 'cards', items: [ROUNDS, CONTENT] },
  { id: 'system', heading: 'System', icon: 'pulse', items: [COST, HEALTH] },
];

export const MODELS: readonly Model[] = [
  {
    id: 'headings',
    name: 'B — headings',
    style: 'headings',
    bet: 'A small heading is the cheapest thing that can name a group, and it never has to be learnt.',
    cost: 'Three lines of chrome that are not pages, and a heading reads as clickable whether or not it is.',
  },
  {
    id: 'boxed',
    name: 'B1 — boxed',
    style: 'boxed',
    bet: 'The direction already draws a container with a 3px border, so a group can be one instead of a label above nothing.',
    cost: 'Three borders inside a bordered rail is a lot of structure competing for the same eye.',
  },
  {
    id: 'dividers',
    name: 'B2 — dividers',
    style: 'dividers',
    bet: 'The grouping is carried by the gaps: a rule between runs is read without being named, and no word is spent on a category nobody clicks.',
    cost: 'A grouping nobody named is a grouping each person names differently.',
  },
  {
    id: 'two-level',
    name: 'B3 — two levels',
    style: 'two-level',
    bet: 'One narrow column of groups beside the pages of the group in hand: the rail stops being a list of eight and becomes a list of four.',
    cost: 'Five of the eight pages are out of sight, so crossing the panel takes two clicks instead of one.',
  },
];

/** Every entry, in rail order — what a keyboard would walk. */
export function allItems(): readonly Item[] {
  return GROUPS.flatMap((group) => group.items);
}

/** The group an entry belongs to. What the two-level rail opens on. */
export function groupOf(itemId: string): Group {
  return (
    GROUPS.find((group) => group.items.some((item) => item.id === itemId)) ??
    (GROUPS[0] as Group)
  );
}
