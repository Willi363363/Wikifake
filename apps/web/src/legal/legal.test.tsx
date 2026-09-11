/** @vitest-environment jsdom */

// The two documents, in both languages.
//
// Prose cannot be asserted — no test says whether a privacy policy is *true*,
// which is why J.3's record sheet names the person who has to read it. What a
// test can hold is everything around the prose, and each of these is a way the
// pages could go wrong quietly:
//
// - a section translated and never rendered, because the order list in
//   `document.tsx` and the catalogue drifted apart. The reader loses a section
//   and nothing anywhere says so;
// - an address that differs between the two languages, which is two policies;
// - an unresolved placeholder, which renders as literal braces in the middle of
//   a legal sentence;
// - a French page that quietly falls back to English, which the parity test in
//   `catalogue.test.ts` cannot see because a fallback is not a missing key.
//
// Queried through `within(container)` rather than `screen`, for the reason
// `reading-sheet.test.tsx` gives: `screen` searches the whole body, and this
// suite renders the same document four times over, so a heading query finds the
// copy from the previous case as readily as this one.
import { within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import enLegal from '../../messages/en/legal.json';
import frLegal from '../../messages/fr/legal.json';
import { LOCALES, type Locale } from '../i18n/locales.js';
import { renderIn } from '../i18n/testing.js';
import { LICENCE } from '../round/attribution.js';
import { LEGAL_CONTACT } from './contact.js';
import { LegalDocument, SECTIONS, type LegalDocumentName } from './document.js';

const CATALOGUES: Record<Locale, typeof enLegal> = { en: enLegal, fr: frLegal };
const DOCUMENTS: LegalDocumentName[] = ['privacy', 'terms'];

interface Section {
  readonly heading: string;
  readonly body: string;
}

/**
 * One document's sections, as a lookup rather than as its own shape.
 *
 * The two documents have different keys, so indexing the union by a section id
 * is an error TypeScript is right about. The annotation is the narrowing: both
 * shapes are records of sections, and this suite only ever asks for a key the
 * list in `document.tsx` declares — which the case below holds to the
 * catalogue's own keys.
 */
function sectionsOf(locale: Locale, name: LegalDocumentName): Record<string, Section> {
  return CATALOGUES[locale][name].sections;
}

describe.each(DOCUMENTS)('J.3 — the %s document', (name) => {
  it.each(LOCALES)('renders every section it declares, in %s', (locale) => {
    const page = within(renderIn(locale, <LegalDocument name={name} />).container);
    const copy = CATALOGUES[locale][name];

    expect(page.getByRole('heading', { level: 1 }).textContent).toBe(copy.title);

    const sections = sectionsOf(locale, name);
    for (const id of SECTIONS[name]) {
      const section = sections[id];
      // Named rather than counted, and asserted before it is read: a missing
      // section would otherwise be queried as the heading `undefined`.
      expect({ id, translated: section !== undefined }).toEqual({ id, translated: true });
      expect(
        page.getByRole('heading', { level: 2, name: section?.heading ?? '' }),
      ).toBeDefined();
    }
  });

  /*
   * The order list and the catalogue, held to each other.
   *
   * A section added to the catalogue and forgotten here is translated, paid
   * for, and invisible — and the page above it still reads as complete, which
   * is what makes it the failure worth a test rather than a review.
   */
  it('renders every section the catalogue carries, and no others', () => {
    expect([...SECTIONS[name]].sort()).toEqual(
      Object.keys(enLegal[name].sections).sort(),
    );
  });

  it.each(LOCALES)('leaves no placeholder unresolved, in %s', (locale) => {
    const { container } = renderIn(locale, <LegalDocument name={name} />);

    // An ICU value nobody passed renders as the literal `{name}`. In a legal
    // sentence that is not a cosmetic defect: it is the address or the licence
    // gone missing from the one paragraph that had to carry it.
    expect(container.textContent ?? '').not.toMatch(/[{}]/);
  });
});

describe('J.3 — the address is one address', () => {
  it.each(LOCALES)('is written as a mailto link, in %s', (locale) => {
    const page = within(renderIn(locale, <LegalDocument name="privacy" />).container);

    const link = page.getByRole('link', { name: LEGAL_CONTACT });
    expect(link.getAttribute('href')).toBe(`mailto:${LEGAL_CONTACT}`);
  });

  // Both documents promise somewhere to write to. A policy naming one inbox and
  // terms naming another is a person writing to the wrong one and concluding
  // that nobody answers.
  it.each(LOCALES)('is the same address on the terms, in %s', (locale) => {
    const page = within(renderIn(locale, <LegalDocument name="terms" />).container);
    expect(page.getByRole('link', { name: LEGAL_CONTACT })).toBeDefined();
  });

  /*
   * Held to the constant rather than to a literal.
   *
   * `LEGAL_CONTACT` is a placeholder today — `.invalid`, reserved by RFC 2606
   * so it cannot be somebody's real inbox — and step J.3 stays 🔶 until the
   * owner replaces it. This test is what makes that replacement one edit: it
   * fails on neither value, and every assertion above follows the constant.
   */
  it('is not written into the catalogue in either language', () => {
    for (const catalogue of Object.values(CATALOGUES)) {
      expect(JSON.stringify(catalogue)).not.toContain('@');
    }
  });
});

describe('J.3 — the licence is the one the round already credits', () => {
  it.each(LOCALES)('names it and links it, in %s', (locale) => {
    const page = within(renderIn(locale, <LegalDocument name="terms" />).container);

    // CC BY-SA obliges us to name the licence and link it wherever the material
    // is offered. `attribution.tsx` does it inside a round; this does it on the
    // page that states the terms, and both read the same constant so they
    // cannot name two different licences.
    const link = page.getByRole('link', { name: LICENCE.name });
    expect(link.getAttribute('href')).toBe(LICENCE.url);
  });
});
