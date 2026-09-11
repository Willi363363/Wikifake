/** @vitest-environment jsdom */

// Every code the server can send has a sentence, in both languages — step 11.9.
//
// The failure this prevents is specific and ugly: a code with no catalogue
// entry renders as the raw identifier, so a player is told `coins_not_accepted`
// in the middle of a round. `next-intl` does not throw on a missing key in
// production — it prints the key — which is why nothing would have failed.
//
// It is a parity test, like the REST catalogue's and the indexing list's: the
// protocol owns the set, the catalogue must answer for all of it, and neither
// side may quietly grow past the other.
import { describe, expect, it } from 'vitest';

import { ERROR_CODES } from '@wikifake/protocol';

import enErrors from '../../messages/en/errors.json';
import frErrors from '../../messages/fr/errors.json';
import { LOCALES, type Locale } from '../i18n/locales.js';
import { renderIn } from '../i18n/testing.js';
import { useRefusal } from './refusal.js';

const CATALOGUES: Record<Locale, typeof enErrors> = { en: enErrors, fr: frErrors };

/** A component whose whole output is one translated refusal. */
function Said({ code }: { readonly code: string | null }) {
  return <output>{useRefusal()(code)}</output>;
}

const said = (locale: Locale, code: string | null): string =>
  renderIn(locale, <Said code={code} />).container.textContent ?? '';

describe('11.9 — every refusal the protocol can send is translated', () => {
  it.each(LOCALES)('answers for every code, in %s', (locale) => {
    const catalogue = CATALOGUES[locale].refusals as Record<string, string>;

    for (const code of ERROR_CODES) {
      const sentence = catalogue[code];
      expect({ code, translated: typeof sentence === 'string' }).toEqual({
        code,
        translated: true,
      });
      // A key echoed back is what a missing entry looks like on screen, and it
      // is a sentence-shaped check because that is what a player reads.
      expect({ code, echoed: sentence === code }).toEqual({ code, echoed: false });
    }
  });

  it('declares no sentence for a code the protocol does not have', () => {
    // `unknown` is the one entry with no code behind it, and it is deliberate.
    const extra = Object.keys(CATALOGUES.en.refusals).filter(
      (key) => key !== 'unknown' && !(ERROR_CODES as readonly string[]).includes(key),
    );
    expect(extra).toEqual([]);
  });
});

describe('11.9 — and a client one version behind still says something', () => {
  it('falls back rather than printing an identifier', () => {
    const answer = said('en', 'a_code_from_the_future');

    expect(answer).not.toContain('a_code_from_the_future');
    expect(answer.length).toBeGreaterThan(20);
  });

  it('says nothing when there is nothing to say', () => {
    expect(said('en', null)).toBe('');
    expect(said('en', '')).toBe('');
  });

  it('says it in French under a French interface', () => {
    // The whole point of the step, in one assertion: the same code, two
    // sentences, neither of them authored by the server.
    expect(said('fr', 'room_not_found')).not.toBe(said('en', 'room_not_found'));
    expect(said('fr', 'room_not_found')).toContain('salon');
  });
});
