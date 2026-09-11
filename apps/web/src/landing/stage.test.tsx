/** @vitest-environment jsdom */

// Step C.2 — the stage, as markup and as a switch.
//
// What a unit test can see here is the document the stage produces and the
// conditions under which it does nothing. What it cannot see is a camera being
// held still, because jsdom has no layout and no scrolling — that half is
// `apps/e2e/specs/landing.spec.ts`, in a browser, which is the only place the
// claim "the scroll is never intercepted" means anything. The stylesheets
// themselves are `movement.test.ts`'s.
import { cleanup, render, screen } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';

import { Stage, WITHOUT_SCRIPT } from './stage.js';
import { BEAT_ATTRIBUTE, CAMERA_ATTRIBUTE, STAGE_PROGRESS } from './use-stage.js';

afterEach(() => {
  cleanup();
});

function beatsOf(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>(`[${BEAT_ATTRIBUTE}]`)];
}

describe('C.2 — the stage is a document first', () => {
  it('keeps its children in order, one beat each', () => {
    const view = render(
      <Stage>
        <p>first</p>
        <p>second</p>
        <p>third</p>
      </Stage>,
    );

    const beats = beatsOf(view.container);
    expect(beats.map((beat) => beat.textContent)).toEqual(['first', 'second', 'third']);
  });

  it('tells the stylesheet how many screens the track is', () => {
    // The count belongs to the markup: adding a beat is adding a child, and the
    // track grows by one screen without a rule moving.
    const view = render(
      <Stage>
        <p>one</p>
        <p>two</p>
      </Stage>,
    );

    const track = view.container.firstElementChild as HTMLElement;
    expect(track.style.getPropertyValue('--stage-beats')).toBe('2');
  });

  it('serves the revert to a browser with no script', () => {
    // Rendered to a string, because that is what a browser with scripting off
    // receives: it never runs React, so the client-side tree is not the thing
    // under test here. The response is.
    const html = renderToStaticMarkup(
      <Stage>
        <p>only</p>
      </Stage>,
    );

    // Without a driver the camera would hold the first beat still and never
    // advance it, so the `<noscript>` block hands the document back — whole,
    // and inside a `<noscript>`, which is what makes it inert for everybody
    // else.
    expect(html).toContain('<noscript>');
    expect(html).toContain(WITHOUT_SCRIPT.trim());

    // **What it says is all this can see.** An earlier version of this test
    // matched three declarations out of that block and passed for as long as
    // the revert was wrong: it reverted the stage and left every ramp inside it
    // running, so a script-less browser got beat 1 and three blank screens.
    // Whether the block is *enough* is held in two places that can tell —
    // `movement.test.ts`, against the scene's own rules, and
    // `apps/e2e/specs/landing-document.spec.ts`, in a browser with scripting
    // off. Step C.6.
  });

  it('leaves everything alone where the stylesheet did not engage', () => {
    // jsdom applies no stylesheet, so the camera is `static` — the same answer
    // a phone gives, and the same one a viewer who asked for less motion gives.
    // The driver reads that from `getComputedStyle` and does nothing, which is
    // why nothing here is transparent or inert.
    const view = render(
      <Stage>
        <a href="/play">first</a>
        <a href="/play">second</a>
      </Stage>,
    );

    // The track still carries the at-rest value it was rendered with, and not
    // the four-decimal one the driver writes: the paint never happened.
    const track = view.container.firstElementChild as HTMLElement;
    expect(track.style.getPropertyValue(STAGE_PROGRESS)).toBe('0');
    // `inert` reflects to an attribute, which is what a jsdom without the
    // property still shows — and what a browser's own devtools show.
    for (const beat of beatsOf(view.container)) {
      expect(beat.hasAttribute('inert')).toBe(false);
    }
    // And both links are still reachable, which is the point of the paragraph
    // above rather than a detail of it.
    expect(screen.getAllByRole('link')).toHaveLength(2);
  });

  it('renders the scene at rest rather than waiting for a frame', () => {
    const view = render(
      <Stage>
        <p>one</p>
        <p>two</p>
        <p>three</p>
      </Stage>,
    );

    // Without this every beat falls back to `--beat-progress: 0` until the
    // driver's first frame — three beats stacked at full opacity, which is a
    // flash on every load and the first thing a visitor sees.
    expect(
      beatsOf(view.container).map((beat) =>
        beat.style.getPropertyValue('--beat-progress'),
      ),
    ).toEqual(['0', '-1', '-2']);
  });

  it('marks the camera where the driver can find it', () => {
    const view = render(
      <Stage>
        <p>one</p>
      </Stage>,
    );

    expect(view.container.querySelector(`[${CAMERA_ATTRIBUTE}]`)).not.toBeNull();
  });
});
