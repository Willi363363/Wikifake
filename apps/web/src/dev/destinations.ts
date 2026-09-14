// Where the navigation can go — step L.1.
//
// Data rather than markup, so the three candidates argue about *shape* and
// never about *contents*. A destination added here appears in all three, which
// is what makes the comparison a comparison.
//
// **The labels are catalogue keys, not words.** `language.test.ts` refuses
// French in the sources, and a mockup drawn on invented copy flatters itself:
// "Classements" is wider than "Board", and the bar has to survive the real one.

export type Zone = 'home' | 'quests' | 'shop' | 'leaderboard' | 'account' | 'admin';

export interface Destination {
  readonly route: string;
  /** The zone the label lives in, and the key inside it. */
  readonly zone: Zone;
  readonly key: string;
  /** Shown only to an account the `admin` table names. */
  readonly adminOnly?: boolean;
}

export const DESTINATIONS: readonly Destination[] = [
  { route: '/play', zone: 'home', key: 'play' },
  { route: '/quests', zone: 'quests', key: 'title' },
  { route: '/shop', zone: 'shop', key: 'title' },
  { route: '/leaderboard', zone: 'leaderboard', key: 'title' },
  { route: '/profile', zone: 'home', key: 'nav.profile' },
  { route: '/admin', zone: 'admin', key: 'title', adminOnly: true },
];

/** What a candidate draws, given who is looking. */
export function destinationsFor(isAdmin: boolean): readonly Destination[] {
  // Filtered, never hidden with an attribute: a non-admin receives no element
  // at all, which is what keeps I.1's decision true while adding the button
  // the owner asked for.
  return DESTINATIONS.filter((one) => one.adminOnly !== true || isAdmin);
}
