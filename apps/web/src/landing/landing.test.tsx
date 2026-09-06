/** @vitest-environment jsdom */

// Step C.1 — the landing, checked as a document.
//
// The point of building the document before the scene is that the
// reduced-motion path of `plans/product/03-landing.md` is the thing that
// already exists rather than the thing retrofitted. This suite is what says so:
// every assertion below reads the markup, not a style, so it keeps holding when
// steps C.2 to C.5 lay a camera over it — and fails if a beat is ever told by
// movement alone.
import { PER_FALSE_POSITIVE, PER_TRUE_POSITIVE } from '@wikifake/domain';
import { cleanup, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import type { Locale } from '../i18n/locales.js';
import { renderIn } from '../i18n/testing.js';
import { LICENCE } from '../round/attribution.js';

import { EXCERPT, FALSE_PARAGRAPH, TRUE_PARAGRAPH } from './excerpt.js';
import { Landing } from './landing.js';

afterEach(() => {
  cleanup();
});

const LOCALES: readonly Locale[] = ['en', 'fr'];

/** The word the call to action carries, per locale. */
const PLAY: Record<Locale, string> = { en: 'Play', fr: 'Jouer' };

describe('C.1 — the landing reads as a document', () => {
  it.each(LOCALES)('has one h1 and the four beats in order, in %s', (locale) => {
    renderIn(locale, <Landing />);

    const levels = screen
      .getAllByRole('heading')
      .map((heading) => Number(heading.tagName.slice(1)));

    // One h1, then a h2 per beat that has a heading of its own — beat 1 *is*
    // the h1. A second h1, or a h3 arriving before its h2, is a document
    // nobody can navigate by heading.
    expect(levels).toEqual([1, 2, 2, 2]);
  });

  it.each(LOCALES)('offers the way in twice, as a link, in %s', (locale) => {
    renderIn(locale, <Landing />);

    // Above the fold and again under the scoreboard. Links rather than
    // buttons: a keyboard has to be able to open the game in a new tab.
    const ways = screen.getAllByRole('link', { name: PLAY[locale] });
    expect(ways).toHaveLength(2);
    for (const way of ways) expect(way.getAttribute('href')).toBe('/play');
  });
});

describe('C.1 — beat 3 is the demonstration', () => {
  it.each(LOCALES)(
    'shows the article as Wikipedia has it, in French, in %s',
    (locale) => {
      const view = renderIn(locale, <Landing />);
      const french = [...view.container.querySelectorAll('[lang="fr"]')].map(
        (node) => node.textContent ?? '',
      );

      // Article content keeps its own language whatever the interface speaks:
      // the game reads `fr.wikipedia.org`, and a landing that translated the
      // extract would be advertising a game that does not exist.
      expect(french.some((text) => text.includes(TRUE_PARAGRAPH))).toBe(true);
    },
  );

  it('rewrites exactly one fact, and marks it', () => {
    const view = renderIn('en', <Landing />);

    const mark = view.container.querySelector('mark');
    expect(mark?.textContent).toBe(EXCERPT.claim);

    // The two paragraphs differ in the marked span and nowhere else. Written as
    // a reconstruction rather than as two literals, so a landing that quietly
    // reworded the extract fails here instead of demonstrating a game whose
    // model rewrites whole sentences.
    expect(FALSE_PARAGRAPH.replace(EXCERPT.claim, EXCERPT.truth)).toBe(TRUE_PARAGRAPH);
    expect(view.container.textContent).toContain(FALSE_PARAGRAPH);
  });

  it.each(LOCALES)('names both values in the interface language, in %s', (locale) => {
    const view = renderIn(locale, <Landing />);

    // The tell is what lets a visitor who reads no French see what changed, so
    // it carries the two numbers rather than pointing at the paragraph.
    const tell = [...view.container.querySelectorAll('p')].filter(
      (node) =>
        node.textContent !== null &&
        node.textContent.includes(EXCERPT.truth) &&
        node.textContent.includes(EXCERPT.claim) &&
        !node.textContent.includes(EXCERPT.before),
    );
    expect(tell).toHaveLength(1);
  });
});

describe('C.1 — the scoreboard is the domain’s scale', () => {
  it.each([
    ['en', ['+150', '0', '-80', '+0.5']],
    ['fr', ['+150', '0', '-80', '+0,5']],
  ] as const)('states it in %s, formatted for the locale', (locale, expected) => {
    const view = renderIn(locale, <Landing />);
    const values = [...view.container.querySelectorAll('dd')].map(
      (node) => node.textContent,
    );

    expect(values).toEqual([...expected]);
    // And those literals are the domain's constants rather than a second
    // opinion on them: C2 has one source of truth and this page is not it.
    expect(expected[0]).toBe(`+${String(PER_TRUE_POSITIVE)}`);
    expect(expected[2]).toBe(`-${String(PER_FALSE_POSITIVE)}`);
  });
});

describe('C.1 — quoting Wikipedia carries its licence', () => {
  it.each(LOCALES)('credits the article and names the licence, in %s', (locale) => {
    renderIn(locale, <Landing />);

    // C6.1's obligation, and it applies here for the reason it applies beside
    // the article in a round: the page shows text taken from Wikipedia, and a
    // modified version of that same text. `attribution.test.tsx` owns the
    // wording; this owns the fact that the landing renders it at all.
    const attribution = screen.getByRole('complementary');

    const licence = within(attribution).getByRole('link', { name: LICENCE.name });
    expect(licence.getAttribute('href')).toBe(LICENCE.url);

    // Found by destination, not by name: the credit quotes the topic with the
    // locale's own quotation marks, and pinning those here would be pinning a
    // translation in the wrong file.
    const source = within(attribution)
      .getAllByRole('link')
      .find((link) => link.getAttribute('href') === EXCERPT.sourceUrl);
    expect(source?.textContent).toContain(EXCERPT.topic);
    expect(source?.getAttribute('lang')).toBe('fr');
  });

  it('links the extract to the revision it was taken from', () => {
    const view = renderIn('en', <Landing />);

    // A bare article link points at where the paragraph *used* to be. The
    // quotation stays checkable, or it is a quotation nobody can disprove.
    const cited = [...view.container.querySelectorAll('a')].map((node) =>
      node.getAttribute('href'),
    );
    expect(cited).toContain(EXCERPT.revisionUrl);
  });
});
