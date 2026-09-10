// Which board a player is on — step G.1.
//
// Three things, and the third is the one the track argues for at length: the
// mapping is total, the fallback is a region rather than an error, and **a
// choice beats an inference**.
import { describe, expect, it } from 'vitest';
import { REGION_IDS } from '@wikifake/protocol';

import { asRegion, effectiveRegion, regionForCountry } from './regions.js';

describe('G.1 — the country a request came from', () => {
  it.each([
    ['FR', 'europe'],
    ['DE', 'europe'],
    ['GB', 'europe'],
    ['UA', 'europe'],
    ['TR', 'europe'],
    ['US', 'americas'],
    ['BR', 'americas'],
    ['CA', 'americas'],
    ['MX', 'americas'],
    ['AR', 'americas'],
    ['JP', 'other'],
    ['KE', 'other'],
    ['AU', 'other'],
    ['IN', 'other'],
  ] as const)('places %s in %s', (code, region) => {
    expect(regionForCountry(code)).toBe(region);
  });

  it('is case-insensitive, because a header is whatever was sent', () => {
    expect(regionForCountry('fr')).toBe('europe');
    expect(regionForCountry(' us ')).toBe('americas');
  });

  it('has an answer for every input, including the ones a CDN invents', () => {
    // `XX` is what a CDN sends when it cannot tell, and the rest are what a
    // deployment behind no CDN at all produces. None of them is an error.
    for (const nothing of [null, undefined, '', '  ', 'XX', 'ZZ', 'not-a-code']) {
      expect(regionForCountry(nothing)).toBe('other');
    }
  });

  it('never answers with something outside the closed list', () => {
    // The list is `protocol`'s, and it is what the override endpoint validates
    // against. A mapping that could return a fourth value would be a column no
    // board queries.
    const answers = new Set(
      ['FR', 'US', 'JP', 'XX', ''].map((code) => regionForCountry(code)),
    );
    for (const answer of answers) expect(REGION_IDS).toContain(answer);
  });

  /*
   * Every two-letter code there is, counted by the region it lands in.
   *
   * This is the assertion that catches the copy-and-paste mistake the two
   * hand-written lists invite: **a code in both**. Order decides such a case
   * silently — `includes` on Europe runs first — and sampling cannot see it,
   * which a mutation run proved by swapping the two checks and passing every
   * other case in this file.
   *
   * The counts are the tripwire. A country added to a list changes one of them,
   * so the number here has to change with it — which is exactly the moment
   * somebody should look at whether the code was already in the other list.
   */
  it('counts every code once, and only once', () => {
    const alphabet = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'];
    const every = alphabet.flatMap((first) =>
      alphabet.map((second) => `${first}${second}`),
    );

    const counted = { europe: 0, americas: 0, other: 0 };
    for (const code of every) counted[regionForCountry(code)] += 1;

    expect(counted.europe).toBe(57);
    expect(counted.americas).toBe(55);
    expect(counted.europe + counted.americas + counted.other).toBe(676);
  });
});

describe('G.1 — the region a player is ranked in', () => {
  it('takes the choice over the inference, always', () => {
    // The track's promise, and the reason there are two columns: a header
    // follows the network, a choice follows the person.
    expect(effectiveRegion({ derivedRegion: 'europe', chosenRegion: 'americas' })).toBe(
      'americas',
    );
  });

  it('falls back to the inference when nothing was chosen', () => {
    expect(effectiveRegion({ derivedRegion: 'europe', chosenRegion: null })).toBe(
      'europe',
    );
  });

  it('reads a profile with neither as `other`, not as an error', () => {
    // Every row created before this step. A player with no region is not a
    // player without a board.
    expect(effectiveRegion({})).toBe('other');
    expect(effectiveRegion({ derivedRegion: null, chosenRegion: null })).toBe('other');
  });

  it('ignores a stored value that is not a region', () => {
    // The columns are `text`, because there is no Postgres enum behind them, so
    // a value from a seed or a migration that is not one of the three has to
    // read as absent rather than as a fourth board.
    expect(effectiveRegion({ derivedRegion: 'atlantis', chosenRegion: null })).toBe(
      'other',
    );
    expect(effectiveRegion({ derivedRegion: 'europe', chosenRegion: 'atlantis' })).toBe(
      'europe',
    );
  });

  it('reads a region back, or null', () => {
    expect(asRegion('europe')).toBe('europe');
    expect(asRegion('atlantis')).toBeNull();
    expect(asRegion(null)).toBeNull();
  });
});
