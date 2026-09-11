// The locales, named once.
//
// Two and exactly two: English is the language the whole interface was
// rewritten into (step 8.10), French is the language coming back as a real
// locale — which is the point of phase 11. Interface language only: the
// articles come from fr.wikipedia.org and keep their own `lang` whatever is
// decided here.
export const LOCALES = ['en', 'fr'] as const;

export type Locale = (typeof LOCALES)[number];

/**
 * What a request gets until it says otherwise.
 *
 * English, because the catalogue is written in English first and a missing
 * French key must never be the silent default. Detection from
 * `Accept-Language` and the explicit switch are step 11.3's; until then every
 * live request is English, and the French rendering is proven by tests.
 */
export const DEFAULT_LOCALE: Locale = 'en';

/**
 * The time zone every date is formatted in — step E.5.
 *
 * **Declared, because the alternative is a hydration mismatch.** `next-intl`
 * warns about exactly this: with no time zone, the server uses the machine's
 * and the browser uses the viewer's, so a server-rendered date can arrive as
 * one day and re-render as another. Vercel's functions run in UTC and a player
 * does not, which is the mismatch in its most common shape.
 *
 * UTC rather than a guess at the viewer's, because a guess is what the warning
 * is about: a stable, stated zone that is occasionally a few hours from
 * somebody's midnight beats a date that changes when React hydrates. The dates
 * this application shows are "playing since March", not train times.
 *
 * A per-player zone is a preference, and `profile.preferences` is where one
 * would go — track E's later steps, not this one.
 */
export const TIME_ZONE = 'UTC';
