// The cache key, and the three numbers that bound the cache.
//
// C4.1 — "Paris", "paris", "  PARIS  " and "PÁRIS" are one entry. The rule is
// not decorative: a player typing an accent or a stray space would otherwise pay
// for a generation the cache already holds.
//
// The order of operations is the Python's, because the order changes the answer:
// case folding **before** decomposition, so `İ` (U+0130) folds to `i` + a
// combining dot which the next step removes, rather than surviving as a
// character no other spelling of the word produces.

/** C4.3 — six hours. */
export const CACHE_TTL_SECONDS = 6 * 3600;

/** C4.3 — distinct articles kept per category, so one search does not serve one article forever. */
export const VARIANTS_PER_CATEGORY = 3;

/** C4.3 — categories kept before the least recently served is evicted. Bounds the memory. */
export const MAX_CATEGORIES = 200;

/**
 * Where `toLowerCase` and Python's `casefold` disagree.
 *
 * `casefold` applies *full* case folding, `toLowerCase` applies simple lowercase,
 * and JavaScript has no equivalent. Two differences can actually reach a
 * Wikipedia title: `ß`, which folds to `ss` (so "Straße" and "Strasse" are one
 * search), and the Greek final sigma, which folds to `σ` (so a word keeps one key
 * whether or not the sigma ends it). The rest of the table is unreachable here
 * and left out rather than copied in unused.
 *
 * Applied after `toLowerCase`, which is what turns `Σ` into a final `ς` in the
 * first place.
 */
const FULL_FOLD: ReadonlyArray<readonly [RegExp, string]> = [
  [/ß/gu, 'ss'],
  [/ς/gu, 'σ'],
];

/** Combining marks — what NFKD separates from its letter so this can drop it. */
const COMBINING = /\p{M}/gu;

/**
 * The cache key for a category, or `''` for a category that has none.
 *
 * C4.1 — an empty category is ignored rather than cached under an empty key: the
 * caller checks the result, and both `get` and `put` refuse it.
 */
export function normaliseCategory(raw: string): string {
  let text = raw.trim().toLowerCase();
  for (const [pattern, replacement] of FULL_FOLD)
    text = text.replace(pattern, replacement);

  // NFKD rather than NFD, as the Python: compatibility folding as well, so "ﬁ"
  // and "fi" are one search and a non-breaking space behaves like a space.
  const decomposed = text.normalize('NFKD').replace(COMBINING, '');

  // Internal runs collapsed: "Paris   Nord" and "Paris Nord" are one search.
  return decomposed
    .split(/\s+/u)
    .filter((word) => word.length > 0)
    .join(' ');
}

/**
 * The key namespace, versioned.
 *
 * The version is in the key because the cached payload has a shape: change the
 * shape and the entries written by the previous deployment are not stale, they
 * are wrong. Bumping the version retires them without a migration and without a
 * flush that would also drop what other work keeps in the same Redis.
 */
export const NAMESPACE = 'article:v1';

/** The list of variants for a category. */
export function variantsKey(key: string): string {
  return `${NAMESPACE}:variants:${key}`;
}

/** C4.4 — the rotation counter for a category. */
export function turnKey(key: string): string {
  return `${NAMESPACE}:turn:${key}`;
}

/** Every live category, scored by when it was last served. The LRU of C4.3. */
export const INDEX_KEY = `${NAMESPACE}:index`;
