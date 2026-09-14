// The panel's eight pages, and the three groups they sit in — step K.1.
//
// Data, not markup, so the rail and the tests read the same list. A section
// added here without a route is a link to a 404, and a route added without an
// entry here is a page nobody can reach — `sections.test.ts` holds both.
//
// **Overview is outside every group** rather than at the top of the first one.
// It is the page about all three, so filing it under one of them would be a
// claim that is not true.

import type { useTranslations } from 'next-intl';

/**
 * A key the `admin` zone of the catalogue actually has.
 *
 * Derived from the translator rather than written as a string, so a section
 * pointing at a key nobody wrote is a compile error instead of a raw
 * identifier on the rail — which is the whole point of `next-intl.d.ts`.
 */
export type AdminKey = Parameters<ReturnType<typeof useTranslations<'admin'>>>[0];

export type SectionIcon =
  'grid' | 'pulse' | 'users' | 'funnel' | 'cards' | 'bars' | 'coin' | 'document';

export interface Section {
  /** The address, under the locale prefix. */
  readonly route: string;
  /**
   * Where the label lives in the `admin` zone of the catalogue.
   *
   * The seven sections reuse the title their own section already had — the
   * rail and the page heading saying different words would be two names for
   * one thing.
   */
  readonly key: AdminKey;
  readonly icon: SectionIcon;
}

export interface Group {
  /** `null` for the run that holds Overview alone. */
  readonly key: AdminKey | null;
  readonly sections: readonly Section[];
}

export const GROUPS: readonly Group[] = [
  {
    key: null,
    sections: [{ route: '/admin', key: 'nav.overview', icon: 'grid' }],
  },
  {
    key: 'nav.groups.audience',
    sections: [
      { route: '/admin/traffic', key: 'traffic.title', icon: 'bars' },
      { route: '/admin/players', key: 'players.title', icon: 'users' },
      { route: '/admin/activation', key: 'activation.title', icon: 'funnel' },
    ],
  },
  {
    key: 'nav.groups.game',
    sections: [
      { route: '/admin/games', key: 'games.title', icon: 'cards' },
      { route: '/admin/content', key: 'content.title', icon: 'document' },
    ],
  },
  {
    key: 'nav.groups.system',
    sections: [
      { route: '/admin/cost', key: 'cost.title', icon: 'coin' },
      { route: '/admin/health', key: 'health.title', icon: 'pulse' },
    ],
  },
];

/** Every page, in rail order — what a keyboard walks and a test counts. */
export const SECTIONS: readonly Section[] = GROUPS.flatMap((group) => group.sections);

/**
 * The section a path is on.
 *
 * Longest route first, so `/admin/cost` is not answered by `/admin`. The
 * locale prefix is stripped by `usePathname` before this sees it.
 */
export function sectionAt(pathname: string): Section | undefined {
  return [...SECTIONS]
    .sort((left, right) => right.route.length - left.route.length)
    .find((section) => pathname === section.route);
}
