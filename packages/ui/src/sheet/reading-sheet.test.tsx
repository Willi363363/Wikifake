// The exemption, as an assertion.
//
// `01-art-direction.md` says the brutalist grammar applies to the chassis and
// never to the article being judged. That is a sentence, and a sentence is what
// erodes: the reading sheet will sit next to loud components for the life of
// this project, and "make it match" is a reasonable-sounding request that would
// undo the decision one class at a time.
//
// So the component owns the surface, and this holds it to owning nothing else.
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { describe, expect, it } from 'vitest';

import { ReadingSheet } from './reading-sheet.js';

/**
 * The rendered element itself, rather than a query over the document.
 *
 * `screen` searches the whole body, and this suite renders several sheets that
 * differ only in their classes — so a label query finds the one from the
 * previous test as readily as this one. Reading the container's own child is
 * unambiguous whatever the cleanup does.
 */
function sheet(element: ReactElement): HTMLElement {
  const { container } = render(element);
  return container.firstElementChild as HTMLElement;
}

const classesOf = (element: ReactElement): string[] =>
  sheet(element).className.split(/\s+/);

describe('B.7 — the reading sheet', () => {
  it('is an article, because that is what it is', () => {
    expect(sheet(<ReadingSheet>Body text.</ReadingSheet>).tagName).toBe('ARTICLE');
  });

  it('renders as something else when a screen needs it to', () => {
    expect(sheet(<ReadingSheet as="section">Body text.</ReadingSheet>).tagName).toBe(
      'SECTION',
    );
  });

  /*
   * The three the direction forbids here.
   *
   * `border-` and `shadow-` are checked as prefixes rather than exact classes,
   * so `border-3`, `border-line-strong` and `shadow-md` all fail — and so does
   * whichever spelling somebody reaches for next.
   */
  it('carries no border and no shadow of its own', () => {
    const classes = classesOf(<ReadingSheet>Body text.</ReadingSheet>);
    expect(classes.filter((name) => name.startsWith('border-'))).toEqual([]);
    expect(classes.filter((name) => name.startsWith('shadow-'))).toEqual([]);
  });

  /*
   * A ground, but never an accent one.
   *
   * "No fill" means no accent, not no colour: a surface whose background is
   * whatever it happens to sit on is a surface whose contrast nobody can
   * measure. `bg-surface` is the pair `CONTRAST_PAIRS` measures at 21.00 and
   * 15.51 — so the ground is required, and every other ground is refused.
   */
  it('sits on the measured surface, and on no accent', () => {
    const classes = classesOf(<ReadingSheet>Body text.</ReadingSheet>);
    expect(classes).toContain('bg-surface');
    expect(classes).toContain('text-ink');
    for (const fill of ['accent', 'accent-line', 'bronze', 'green', 'warn', 'danger']) {
      expect(classes).not.toContain(`bg-${fill}`);
      expect(classes).not.toContain(`bg-${fill}-soft`);
    }
  });

  it('holds the line to a readable measure', () => {
    // In `ch`, so the measure follows the type rather than guessing at it, and
    // inside the 60–75 the direction names.
    expect(classesOf(<ReadingSheet>Body text.</ReadingSheet>).join(' ')).toMatch(
      /max-w-\[(6[0-9]|7[0-5])ch\]/,
    );
  });

  // A caller still needs to place it — margin, padding, a grid cell. What it
  // must not be able to do is repaint it, and the assertions above are what
  // say so; this one only proves the layout hook still works.
  it('takes a class for layout', () => {
    expect(
      classesOf(<ReadingSheet className="mx-auto">Body text.</ReadingSheet>),
    ).toContain('mx-auto');
  });
});
