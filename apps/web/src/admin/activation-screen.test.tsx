/** @vitest-environment jsdom */

// Activation and return — step I.4, on the screen.
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

describe('I.4 — the two figures the track names', () => {
  it('shows activation and return as percentages', () => {
    render(<ActivationSection activation={view()} />);

    expect(screen.getByText('50%')).not.toBeNull();
    expect(screen.getByText('25%')).not.toBeNull();
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

    expect(screen.getAllByText('—')).toHaveLength(2);
    expect(screen.queryByText('0%')).toBeNull();
  });

  it('keeps a real zero visible, which is not the same as no whole', () => {
    render(<ActivationSection activation={view({ activation: 0 })} />);

    // A hundred and twenty accounts and nobody played is news, and it must not
    // look like the launch-day em dash.
    expect(screen.getByText('0%')).not.toBeNull();
  });

  it('says what each figure is of', () => {
    render(<ActivationSection activation={view()} />);

    expect(screen.getByText(/Of the accounts created/)).not.toBeNull();
    expect(screen.getByText(/Of those who finished a round/)).not.toBeNull();
  });
});

describe('I.4 — the funnel below', () => {
  it('lists the four steps, in order, with their counts', () => {
    render(<ActivationSection activation={view()} />);

    const items = screen.getAllByRole('listitem').map((item) => item.textContent);
    expect(items[0]).toContain('Accounts created');
    expect(items[0]).toContain('120');
    expect(items[3]).toContain('Came back another day');
    expect(items[3]).toContain('15');
  });

  it('shows a step against the one above it, and not the first', () => {
    render(<ActivationSection activation={view()} />);

    const items = screen.getAllByRole('listitem').map((item) => item.textContent);
    expect(items[0]).not.toContain('of the step above');
    expect(items[1]).toContain('of the step above');
    expect(items[1]).toContain('75%');
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

  it('draws the bars as decoration, not as information', () => {
    // A length is not a fact a screen reader can read, and the percentage is
    // already there in text.
    const { container } = render(<ActivationSection activation={view()} />);

    const bars = container.querySelectorAll('div[aria-hidden="true"]');
    expect(bars).toHaveLength(4);
  });

  it('says the same things in French', () => {
    renderIn('fr', <ActivationSection activation={view()} />);

    expect(screen.getByText('Comptes créés')).not.toBeNull();
    expect(screen.getByText(/pas une courbe de cohorte/)).not.toBeNull();
  });
});
