import { describe, expect, it } from 'vitest';

import {
  CACHE_TTL_SECONDS,
  INDEX_KEY,
  MAX_CATEGORIES,
  normaliseCategory,
  turnKey,
  variantsKey,
  VARIANTS_PER_CATEGORY,
} from './keys.js';

describe('C4.1 — the cache key', () => {
  // The four spellings the contract names, verbatim, including the two spaces.
  it.each(['Paris', 'paris', '  PARIS  ', 'PÁRIS'])(
    'reads %o as one entry',
    (spelling) => {
      expect(normaliseCategory(spelling)).toBe('paris');
    },
  );

  it.each(['', '   ', '\t\n', ' '])('has no key for %o', (blank) => {
    expect(normaliseCategory(blank)).toBe('');
  });

  it('collapses internal runs, so one search does not become two', () => {
    expect(normaliseCategory('Paris   Nord')).toBe('paris nord');
    expect(normaliseCategory('Paris\tNord')).toBe('paris nord');
    // A non-breaking space is whitespace once NFKD has folded it. Wikipedia
    // titles are full of them, and a player copying one in would otherwise pay
    // for an article the cache already holds.
    expect(normaliseCategory('Paris Nord')).toBe('paris nord');
  });

  it('folds compatibility forms, because NFKD and not NFD', () => {
    expect(normaliseCategory('ﬁnance')).toBe('finance');
    expect(normaliseCategory('Henri Ⅳ')).toBe('henri iv');
    expect(normaliseCategory('m²')).toBe('m2');
  });

  it('strips every accent, not only the ones on vowels', () => {
    expect(normaliseCategory('Édouard')).toBe('edouard');
    expect(normaliseCategory('Besançon')).toBe('besancon');
    expect(normaliseCategory('Nöel')).toBe('noel');
  });

  // Where `toLowerCase` and Python's `casefold` disagree. Both are asserted
  // rather than assumed: without the explicit fold, "Straße" and "Strasse" are
  // two entries here and one in the Python, and nothing would say so.
  it('applies full case folding where it can be reached', () => {
    expect(normaliseCategory('Straße')).toBe('strasse');
    expect(normaliseCategory('Strasse')).toBe('strasse');
    expect(normaliseCategory('ΟΔΥΣΣΕΥΣ')).toBe(normaliseCategory('Οδυσσευς'));
  });

  it('folds the Turkish dotted capital to a plain i', () => {
    expect(normaliseCategory('İstanbul')).toBe('istanbul');
  });

  it('is idempotent — a key normalised twice is the same key', () => {
    for (const raw of ['  PÁRIS  ', 'Straße', 'Henri Ⅳ', 'Paris   Nord']) {
      const once = normaliseCategory(raw);
      expect(normaliseCategory(once)).toBe(once);
    }
  });
});

describe('C4.3 — the bounds', () => {
  it('is six hours, three variants, two hundred categories', () => {
    expect(CACHE_TTL_SECONDS).toBe(6 * 3600);
    expect(VARIANTS_PER_CATEGORY).toBe(3);
    expect(MAX_CATEGORIES).toBe(200);
  });
});

describe('the key namespace', () => {
  it('is versioned, so a payload shape change retires its own entries', () => {
    expect(variantsKey('paris')).toBe('article:v1:variants:paris');
    expect(turnKey('paris')).toBe('article:v1:turn:paris');
    expect(INDEX_KEY).toBe('article:v1:index');
  });

  it('keeps the three key kinds apart', () => {
    const keys = new Set([variantsKey('paris'), turnKey('paris'), INDEX_KEY]);
    expect(keys.size).toBe(3);
  });
});
