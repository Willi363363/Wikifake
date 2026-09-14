/** @vitest-environment jsdom */

// Activation and return — step K.5, on the screen.
//
// Amended rather than rewritten when the section became the funnel page: every
// claim I.4 made is still a claim about it, and where the shape moved a fact —
// *of the step above* is a legend once now, not a phrase on four rows — the
// case moved with it rather than being deleted.
//
// One claim carries most of these cases: **null is not nought per cent.** The
// day before launch, a panel reading 0% on its headline figure would report a
// failure that has not happened, so an absent whole renders as an em dash.
//
// Whether the figures are right is `activation.test.ts` against a real database.
import { cleanup, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { ActivationSection } from './activation-screen.js';
import { render, renderIn } from '../i18n/testing.js';
import type { ActivationView } from './activation.js';

afterEach(() => {
  cleanup();
});

/**
 * What one tile says, label included.
 *
 * The funnel below repeats the same counts and the same shares — that is what a
 * funnel *is* — so a bare `getByText('25%')` finds two elements and says
 * nothing about which. Reading the tile through its label is what makes these
 * cases about the four figures rather than about the page's text.
 */
function tile(label: string): string {
  // The first match, because the tiles are the first thing on the page: a step
  // name also appears inside its funnel bar and again in the definition list
  // below it, and all three saying the same word is the point of the page.
  return screen.getAllByText(label)[0]?.parentElement?.textContent ?? '';
}

function view(over: Partial<ActivationView> = {}): ActivationView {
  return {
    activation: 0.5,
    returnRate: 0.25,
    funnel: [
      { name: 'created', count: 120, ofPrevious: null, ofCreated: null },
      { name: 'started', count: 90, ofPrevious: 0.75, ofCreated: 0.75 },
      { name: 'finished', count: 60, ofPrevious: 2 / 3, ofCreated: 0.5 },
      { name: 'returned', count: 15, ofPrevious: 0.25, ofCreated: 0.125 },
    ],
    ...over,
  };
}

describe('K.5 — the two figures the track names', () => {
  it('shows activation and return as percentages', () => {
    render(<ActivationSection activation={view()} />);

    expect(tile('Activation')).toContain('50%');
    expect(tile('Came back')).toContain('25%');
  });

  it('shows an em dash rather than 0% when there is no whole', () => {
    render(
      <ActivationSection
        activation={view({
          activation: null,
          returnRate: null,
          funnel: [
            { name: 'created', count: 0, ofPrevious: null, ofCreated: null },
            { name: 'started', count: 0, ofPrevious: null, ofCreated: null },
            { name: 'finished', count: 0, ofPrevious: null, ofCreated: null },
            { name: 'returned', count: 0, ofPrevious: null, ofCreated: null },
          ],
        })}
      />,
    );

    // Six em dashes and not two: the two rates, and the share of the step
    // above on each of the four funnel rows, which has no whole either.
    expect(screen.getAllByText('—')).toHaveLength(6);
    expect(screen.queryByText('0%')).toBeNull();
    expect(tile('Activation')).toContain('—');
  });

  it('keeps a real zero visible, which is not the same as no whole', () => {
    render(<ActivationSection activation={view({ activation: 0 })} />);

    // A hundred and twenty accounts and nobody played is news, and it must not
    // look like the launch-day em dash.
    expect(tile('Activation')).toContain('0%');
  });

  it('says what each figure is of', () => {
    render(<ActivationSection activation={view()} />);

    expect(screen.getByText(/Of the accounts created/)).not.toBeNull();
    expect(screen.getByText(/Of those who finished a round/)).not.toBeNull();
  });
});

describe('K.5 — the funnel below', () => {
  it('lists the four steps, in order, with their counts', () => {
    render(<ActivationSection activation={view()} />);

    const items = screen.getAllByRole('listitem').map((item) => item.textContent);
    expect(items[0]).toContain('Accounts created');
    expect(items[0]).toContain('120');
    expect(items[3]).toContain('Came back another day');
    expect(items[3]).toContain('15');
  });

  it('shows a step against the one above it, and the first against nothing', () => {
    // K.5 names the two columns once, in a legend, rather than repeating "of
    // the step above" on four rows — but the first step still has nothing
    // above it, and an em dash is what that looks like.
    render(<ActivationSection activation={view()} />);

    expect(screen.getByText(/share of the step above/)).not.toBeNull();

    const items = screen.getAllByRole('listitem').map((item) => item.textContent);
    expect(items[0]).toContain('—');
    expect(items[1]).toContain('75%');
    expect(items[2]).toContain('66.7%');
  });

  it('carries the two rates and the two counts as figures above it', () => {
    // The shape the owner chose: the answer first, the working below it.
    render(<ActivationSection activation={view()} />);

    expect(tile('Accounts created')).toContain('120');
    expect(tile('Accounts created')).toContain('in this period');
    expect(tile('Finished a round')).toContain('60');
    expect(tile('Finished a round')).toContain('15 came back');
  });

  it('explains what each step counts', () => {
    render(<ActivationSection activation={view()} />);

    expect(screen.getByText(/Guests are not counted/)).not.toBeNull();
    expect(
      screen.getByText(/Two rounds in one sitting is not coming back/),
    ).not.toBeNull();
  });

  it('says what "came back" cannot tell you', () => {
    // On the screen rather than left to be discovered: nothing records per-day
    // history, so a return tomorrow and a return in six months look the same.
    render(<ActivationSection activation={view()} />);

    expect(screen.getByText(/not a cohort curve/)).not.toBeNull();
  });

  it('puts the step name inside its own bar, so a length is never the fact', () => {
    // I.4 drew the bars `aria-hidden` and wrote the name beside them. K.5's
    // bar carries the name, which is the same promise kept by a different
    // shape: nothing here is readable only as a width.
    render(<ActivationSection activation={view()} />);

    const items = screen.getAllByRole('listitem').map((item) => item.textContent);
    expect(items).toHaveLength(4);
    for (const item of items) {
      expect(item).not.toBe('');
    }
  });

  it('says the same things in French', () => {
    renderIn('fr', <ActivationSection activation={view()} />);

    expect(screen.getAllByText('Comptes créés').length).toBeGreaterThan(0);
    expect(screen.getByText(/pas une courbe de cohorte/)).not.toBeNull();
    expect(screen.getByText('L’entonnoir')).not.toBeNull();
  });
});
