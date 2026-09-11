/** @vitest-environment jsdom */

// The FAQ as structured data — step J.5.
//
// Two ways this goes wrong and neither is visible on the page: the JSON-LD says
// something the page does not, or it is not valid JSON at all — in which case a
// search engine drops it silently and nobody finds out until somebody looks at
// a report six months later.
//
// So: parse what is emitted, and hold every question in it to the catalogue the
// page renders from.
import { describe, expect, it } from 'vitest';

import enLegal from '../../messages/en/legal.json';
import frLegal from '../../messages/fr/legal.json';
import { FaqStructuredData } from './faq-data.js';
import { SECTIONS } from './document.js';
import { LOCALES, type Locale } from '../i18n/locales.js';
import { renderIn } from '../i18n/testing.js';

const CATALOGUES: Record<Locale, typeof enLegal> = { en: enLegal, fr: frLegal };

interface FaqDocument {
  readonly '@type': string;
  readonly mainEntity: {
    readonly name: string;
    readonly acceptedAnswer: { readonly text: string };
  }[];
}

function emitted(locale: Locale): FaqDocument {
  const { container } = renderIn(locale, <FaqStructuredData />);
  const script = container.querySelector('script[type="application/ld+json"]');
  expect(script).not.toBeNull();

  // Parsed rather than matched: a block that is not JSON is a block a search
  // engine drops without saying so, and a regex would pass on it.
  return JSON.parse(script?.textContent ?? '') as FaqDocument;
}

describe('J.5 — the FAQ, as data', () => {
  it.each(LOCALES)('emits a FAQPage of every question, in %s', (locale) => {
    const document = emitted(locale);
    const sections = CATALOGUES[locale].faq.sections as Record<
      string,
      { heading: string; body: string }
    >;

    expect(document['@type']).toBe('FAQPage');
    expect(document.mainEntity.map((entry) => entry.name)).toEqual(
      SECTIONS.faq.map((id) => sections[id]?.heading),
    );
    expect(document.mainEntity.map((entry) => entry.acceptedAnswer.text)).toEqual(
      SECTIONS.faq.map((id) => sections[id]?.body),
    );
  });

  it('says it in the language the page is in', () => {
    // Two documents that differ, rather than an English block under a French
    // page — which is what a hand-written JSON-LD block would have been.
    expect(emitted('fr').mainEntity[0]?.name).not.toBe(emitted('en').mainEntity[0]?.name);
  });

  // A `<` in a translated answer would close the script tag and turn the rest
  // of the page into text. Escaped rather than assumed impossible: the answers
  // are written by hand, and the next hand is not this one.
  it('cannot be closed by a character somebody types into a translation', () => {
    const { container } = renderIn('en', <FaqStructuredData />);
    const raw = container.querySelector('script')?.innerHTML ?? '';

    expect(raw).not.toContain('<');
    expect(JSON.parse(raw)).toBeDefined();
  });
});
