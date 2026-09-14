// Where the navigation goes — step L.4.
//
// **This is the first global navigation this application has ever had.** Before
// it, the only path to the shop was an underlined word in a paragraph at the
// bottom of the profile, which was itself two clicks in — three clicks to reach
// a page whose whole purpose is to be visited often. The bar does not shorten
// that path; it creates the first one.
//
// Data rather than markup, so the bar and its tests read the same list. A
// destination added here appears everywhere the bar does, which is the point.

/** A zone of the catalogue, and the key inside it. */
export interface Destination {
  readonly route: string;
  readonly zone: 'home' | 'quests' | 'shop' | 'leaderboard' | 'admin';
  readonly key: string;
  /**
   * Rendered only for an account the `admin` table names — step L.5.
   *
   * Filtered on the server, never hidden with an attribute: I.1 decided that
   * nothing announces the panel to somebody who cannot open it, and an element
   * with `hidden` on it announces it to anybody who opens the page source.
   */
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

/** What the bar draws, given who is looking. */
export function destinationsFor(isAdmin: boolean): readonly Destination[] {
  return DESTINATIONS.filter((one) => one.adminOnly !== true || isAdmin);
}
