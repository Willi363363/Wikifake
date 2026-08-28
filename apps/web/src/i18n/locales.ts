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
