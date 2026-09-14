// Which palette a reader gets — step L.9, and the vocabulary is the whole file.
//
// L.3 wrote two palettes and measured 42 pairs across them. Nothing on the site
// ever applied the second: `.dark` was set inside `/gallery` and nowhere else,
// so twenty-two dark tokens shipped that no player could reach. This is the
// missing half of the owner's *"un mode light et dark"*.
//
// **Three states, not two.** *System* is not a synonym for *light*: a reader who
// has never chosen is asking the machine, and the machine's answer changes at
// dusk on most of them. A two-state switch would have to pick a side on their
// behalf and would be wrong half the day.
//
// The choice is a cookie rather than an account setting, for the same reason the
// locale is one: it belongs to the browser somebody is reading in, not to a
// person, and a guest has no account to keep it on.

/** The three answers, in the order the switch offers them. */
export const THEMES = ['system', 'light', 'dark'] as const;

export type Theme = (typeof THEMES)[number];

/** What a reader gets when they have never chosen: the machine's own answer. */
export const DEFAULT_THEME = 'system' satisfies Theme;

/**
 * The cookie, named like the locale's for the same reason it exists.
 *
 * Read on the server in the root layout, so the class is on `<html>` in the
 * first byte of the response. A theme applied after hydration is a page that
 * flashes the wrong palette at everybody who chose the other one.
 */
export const THEME_COOKIE = 'THEME';

/** A year. The choice is a preference, not a session. */
export const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** The chosen theme, or the default for anything a cookie could carry. */
export function themeFrom(value: string | undefined): Theme {
  return THEMES.find((known) => known === value) ?? DEFAULT_THEME;
}

/**
 * The class the document carries, or null for *system*.
 *
 * Null rather than `'system'`: the stylesheet has no such class, and it must
 * not. `system` is the absence of a choice, and the absence of a class is what
 * lets `prefers-color-scheme` answer — a third class would be a third palette
 * somebody has to write.
 */
export function classFor(theme: Theme): string | null {
  return theme === 'system' ? null : theme;
}

/**
 * Where to send a reader back to after they have chosen.
 *
 * Only a path on this site, and the check is the point: the form carries where
 * it was submitted from, a form is something anybody can post, and a redirect
 * that trusted that field would forward a visitor anywhere on the web with our
 * own domain in front of it.
 *
 * `//host` is refused as well as `https://host` — a protocol-relative URL is an
 * absolute one that merely looks like a path.
 */
export function safeReturn(asked: string | null, fallback = '/'): string {
  if (asked === null || !asked.startsWith('/') || asked.startsWith('//')) return fallback;
  return asked;
}
