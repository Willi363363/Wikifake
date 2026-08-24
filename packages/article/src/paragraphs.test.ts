// The parity test. This phase's first pitfall says to write it first, and this is
// it: everything downstream — grading, hints, the debrief — rests on
// `paragraphs[i]` being the i-th collected node.
//
// Run against real frozen Wikipedia HTML, because the shapes that break parity
// are the ones a hand-written fixture does not think to contain: references,
// non-breaking spaces, nested inline tags, image captions.
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
  collectParagraphs,
  injectFalsifications,
  MIN_CONTENT_CHARS,
  normaliseText,
} from './paragraphs.js';

const FIXTURES = fileURLToPath(new URL('../fixtures/', import.meta.url));

function fixture(name: string): string {
  return readFileSync(`${FIXTURES}${name}`, 'utf8');
}

const REAL_PAGES = readdirSync(FIXTURES)
  .filter((name) => name.endsWith('.html') && name !== 'variants.html')
  .sort();

describe('the fixtures are real pages', () => {
  it('found them', () => {
    expect(REAL_PAGES).toEqual(['chat.html', 'chocolat.html']);
  });

  it('each names the revision it was taken from', () => {
    for (const name of REAL_PAGES) {
      expect(fixture(name), name).toMatch(/revision \d+/);
    }
  });

  // C6.1 — the text is CC BY-SA, and a fixture is a reuse like any other.
  it('each carries its licence', () => {
    for (const name of REAL_PAGES) {
      expect(fixture(name), name).toContain('CC BY-SA');
    }
  });
});

describe('C3.2 — index parity', () => {
  it.each(REAL_PAGES)('%s: every text belongs to the node at the same index', (name) => {
    const article = collectParagraphs(fixture(name));

    expect(article.paragraphs).not.toHaveLength(0);
    expect(article.nodes).toHaveLength(article.paragraphs.length);

    // The claim, checked node by node: the text at index i is the text of the
    // node at index i, read straight off the document.
    for (const [index, text] of article.paragraphs.entries()) {
      const node = article.nodes[index];
      expect(node, `no node at ${index}`).toBeDefined();
      const fromDocument = normaliseText(article.document(node).text());
      // `text()` has no separator, so inline tags run together; comparing the
      // two normalised forms with spaces stripped is what makes this an
      // identity check on the node rather than on the formatting.
      expect(text.replaceAll(' ', ''), `paragraph ${index}`).toBe(
        fromDocument.replaceAll(' ', ''),
      );
    }
  });

  it.each(REAL_PAGES)(
    '%s: writing to index i changes paragraph i and no other',
    (name) => {
      const article = collectParagraphs(fixture(name));
      const target = 1;
      const before = [...article.paragraphs];

      const { paragraphs, html } = injectFalsifications(
        article,
        new Map([[target, 'Un texte entièrement falsifié pour ce test de parité.']]),
      );

      expect(paragraphs[target]).toBe(
        'Un texte entièrement falsifié pour ce test de parité.',
      );
      for (const [index, text] of before.entries()) {
        if (index === target) continue;
        expect(paragraphs[index], `paragraph ${index} moved`).toBe(text);
      }

      // And the document really changed: re-collecting the emitted HTML finds the
      // falsified text at the same index. This is the end of the chain — if the
      // injection wrote to a different node, the player would be graded on a
      // paragraph nobody touched.
      const reread = collectParagraphs(html);
      expect(reread.paragraphs[target]).toBe(
        'Un texte entièrement falsifié pour ce test de parité.',
      );
    },
  );

  // C3.6 — the generator is stateless: two concurrent games must not mutate each
  // other. Two collections of the same HTML share nothing.
  it.each(REAL_PAGES)('%s: two collections are independent', (name) => {
    const html = fixture(name);
    const first = collectParagraphs(html);
    const second = collectParagraphs(html);

    injectFalsifications(first, new Map([[0, 'Falsifié dans la première partie.']]));

    expect(second.paragraphs[0]).not.toBe('Falsifié dans la première partie.');
    expect(second.paragraphs[0]).toBe(collectParagraphs(html).paragraphs[0]);
  });
});

describe('C3.4 — what is collected, and what is not', () => {
  it('drops variants served twice, keeps the rest in document order', () => {
    const article = collectParagraphs(fixture('variants.html'));

    // Two real paragraphs plus one distinct one; the duplicate and the caption
    // are gone.
    expect(article.paragraphs).toHaveLength(3);
    expect(new Set(article.paragraphs).size).toBe(3);
    expect(article.paragraphs[2]).toContain('plancher des cinquante caractères');
  });

  it('drops a paragraph of 50 characters or fewer, keeps 51', () => {
    const short = 'x'.repeat(MIN_CONTENT_CHARS);
    const long = 'y'.repeat(MIN_CONTENT_CHARS + 1);
    const article = collectParagraphs(
      `<div id="bodyContent"><p>${short}</p><p>${long}</p></div>`,
    );
    expect(article.paragraphs).toEqual([long]);
  });

  it('visits a nested paragraph once, not twice', () => {
    const text = 'z'.repeat(60);
    const article = collectParagraphs(
      `<div id="bodyContent"><p>${text}</p><div><p>${text}b</p></div></div>`,
    );
    expect(article.paragraphs).toEqual([text, `${text}b`]);
  });

  it('falls back to the whole document when there is no bodyContent', () => {
    const text = 'w'.repeat(60);
    expect(collectParagraphs(`<p>${text}</p>`).paragraphs).toEqual([text]);
  });

  it('collects nothing from a page with no paragraph', () => {
    expect(
      collectParagraphs('<div id="bodyContent"><h2>Titre</h2></div>').paragraphs,
    ).toEqual([]);
  });
});

describe('C3.5 — whitespace normalisation', () => {
  it('separates words glued by inline tags', () => {
    const padding = 'a'.repeat(60);
    const article = collectParagraphs(`<p>${padding} un<b>deux</b>trois</p>`);
    expect(article.paragraphs[0]).toBe(`${padding} un deux trois`);
  });

  // The other half, and the reason a naive separator is not enough: inserting a
  // space everywhere detaches punctuation.
  it('does not detach punctuation', () => {
    const padding = 'a'.repeat(60);
    const article = collectParagraphs(`<p>${padding} Paris <b>1889</b> .</p>`);
    expect(article.paragraphs[0]).toBe(`${padding} Paris 1889.`);
  });

  it.each([
    ['1889 .', '1889.'],
    ['fin , suite', 'fin, suite'],
    ['30 %', '30%'],
    ['oui !', 'oui!'],
    ['(1889 )', '(1889)'],
  ])('normalises %o to %o', (raw, expected) => {
    expect(normaliseText(raw)).toBe(expected);
  });

  it('turns non-breaking spaces into ordinary ones', () => {
    expect(normaliseText('12\u00A0000\u202Fkm')).toBe('12 000 km');
  });

  it('collapses runs of whitespace', () => {
    expect(normaliseText('un   \n\t deux')).toBe('un deux');
  });

  // Real pages are where this matters: fixtures carry non-breaking spaces
  // before units and inside numbers.
  it.each(REAL_PAGES)('%s: no paragraph keeps a non-breaking space', (name) => {
    for (const text of collectParagraphs(fixture(name)).paragraphs) {
      expect(text).not.toMatch(/[\u00A0\u202F\u2009\u2007]/);
    }
  });

  it.each(REAL_PAGES)('%s: no paragraph has a space before punctuation', (name) => {
    for (const text of collectParagraphs(fixture(name)).paragraphs) {
      expect(text).not.toMatch(/\s[.,;:!?)]/);
    }
  });
});

describe('injection refuses what it cannot do', () => {
  it('names the index when there is no paragraph there', () => {
    const article = collectParagraphs(fixture('chat.html'));
    expect(() => injectFalsifications(article, new Map([[999, 'x']]))).toThrow(/999/);
  });
});
