/** @vitest-environment jsdom */

// Step C.4 — the two article beats have the same shape, and that is the point.
//
// Beat 3's collision only reads if its paragraph lands on the rectangle beat 2's
// occupied. The stylesheet holds that with three fixed rows; what holds *this*
// side of it is that both beats come out of one component, so a row added to one
// is a row added to both. This suite is what notices if that ever stops being
// true — a browser can measure the alignment, but only after somebody has
// scrolled to exactly the right place.
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { ArticleBeat } from './article-beat.js';

afterEach(() => {
  cleanup();
});

function rowsOf(container: HTMLElement): string[] {
  const section = container.querySelector('.landing-article');
  return [...(section?.children ?? [])].map((row) => row.className.split(' ')[0] ?? '');
}

describe('C.4 — both article beats are laid out the same way', () => {
  it('renders three rows, whether or not the third has anything to say', () => {
    const withTail = render(
      <ArticleBeat
        headingId="a"
        title="t"
        body="b"
        paragraph="p"
        caption="c"
        tail="the tell"
      />,
    );
    const rows = rowsOf(withTail.container);
    cleanup();

    const without = render(
      <ArticleBeat headingId="a" title="t" body="b" paragraph="p" caption="c" />,
    );

    // Beat 2 reserves the row it has nothing to put in. Without that the two
    // sheets sit at different heights and nothing collides — and the failure is
    // invisible until somebody scrolls to the handover and looks.
    expect(rowsOf(without.container)).toEqual(rows);
    expect(rows).toHaveLength(3);
  });

  it('leaves the reserved row empty rather than filling it', () => {
    const view = render(
      <ArticleBeat headingId="a" title="t" body="b" paragraph="p" caption="c" />,
    );

    expect(view.container.querySelector('.landing-article__tail')?.textContent).toBe('');
  });

  it('sends the two paragraphs in from opposite sides', () => {
    const under = render(
      <ArticleBeat headingId="a" title="t" body="b" paragraph="p" caption="c" />,
    );
    expect(under.container.querySelector('figure')?.className).toContain(
      'landing-move--from-right',
    );
    cleanup();

    const over = render(
      <ArticleBeat over headingId="a" title="t" body="b" paragraph="p" caption="c" />,
    );
    // A paragraph that arrived from the side its predecessor left towards would
    // read as a carousel rather than as a correction.
    expect(over.container.querySelector('figure')?.className).toContain(
      'landing-move--over',
    );
  });
});
