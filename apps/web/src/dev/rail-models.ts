// The navigation — a scratch route, not a product one.
//
// Settled, and no longer varying: eight pages under Audience, The game and
// System, each group drawn as its own bordered block (B1). What varies now is
// the Overview page, in `overview-layouts.tsx`.
//
// The labels are English because everything in this repository is, including
// the interface (`CLAUDE.md`). The seven that already exist are the English
// catalogue's own words — `messages/en/admin.json`.

/** The icons the lab draws. One name per glyph in `rail-icon.tsx`. */
export type IconName =
  'grid' | 'pulse' | 'users' | 'funnel' | 'cards' | 'bars' | 'coin' | 'document';

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
