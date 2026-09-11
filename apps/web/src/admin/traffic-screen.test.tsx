/** @vitest-environment jsdom */

// Arrivals — step J.4b, on the screen.
//
// Most of these are about the three things a traffic panel is normally silent
// about, and each of them is a way a reader draws a conclusion the number does
// not support: **an em dash rather than 0% when nobody arrived**, **the day
// counting started**, and **loads are not people**.
//
// The fourteen-row cap has its own case for a duller reason: a range of ninety
// days must not quietly become a wall of rows, and the days it drops must be
// counted rather than disappear.
import { cleanup, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { TrafficSection } from './traffic-screen.js';
import { render, renderIn } from '../i18n/testing.js';
import type { TrafficView } from './traffic.js';

afterEach(() => {
  cleanup();
});

function view(over: Partial<TrafficView> = {}): TrafficView {
  return {
    landing: 0,
    entry: 0,
    reach: null,
    days: [],
    since: null,
    ...over,
  };
}

const day = (index: number) => ({
  day: `2026-09-${String(index).padStart(2, '0')}`,
  landing: index,
  entry: 1,
});

describe('J.4b — the arrivals section', () => {
  it('leads with the ratio, and shows what it divided', () => {
    render(<TrafficSection traffic={view({ landing: 40, entry: 10, reach: 0.25 })} />);

    expect(screen.getByText('25%')).toBeDefined();

    // Read off the one line rather than off the page: `/10/` also matches the
    // "100%" in the footnote, and a test that passes on the wrong element is a
    // test that stops noticing when the right one disappears.
    const counts = screen.getByText(/Landing/).textContent ?? '';
    expect(counts).toContain('40');
    expect(counts).toContain('10');
  });

  /*
   * An em dash, not 0%.
   *
   * A reach of zero says the landing failed. Nobody arrived says nothing about
   * the landing at all, and printing 0% for it is the panel inventing a finding.
   */
  it('prints an em dash when there is nothing to divide', () => {
    render(<TrafficSection traffic={view()} />);

    expect(screen.getByText('—')).toBeDefined();
    expect(screen.queryByText('0%')).toBeNull();
  });

  it('says nothing was counted in the range, rather than showing an empty table', () => {
    render(<TrafficSection traffic={view({ since: '2026-09-01' })} />);

    expect(screen.getByText(/Nothing was counted in this range/)).toBeDefined();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('names the day counting began, because a longer range predates it', () => {
    render(<TrafficSection traffic={view({ since: '2026-09-01', days: [day(1)] })} />);

    expect(screen.getByText(/Counting began on 2026-09-01/)).toBeDefined();
  });

  it('says so when nothing has ever been counted', () => {
    render(<TrafficSection traffic={view()} />);

    expect(screen.getByText(/what a new counter looks like/)).toBeDefined();
  });

  // The sentence that stops somebody reading this as visitors. It is the same
  // claim the privacy policy makes, from the other side.
  it('says these are loads and not people', () => {
    render(<TrafficSection traffic={view({ days: [day(1)] })} />);

    expect(screen.getByText(/page loads, not people/)).toBeDefined();
  });

  it('shows a fortnight and counts what it left out', () => {
    const days = Array.from({ length: 20 }, (_, index) => day(index + 1));
    render(<TrafficSection traffic={view({ days, since: '2026-09-01' })} />);

    expect(screen.getAllByRole('row')).toHaveLength(15); // fourteen days plus the head
    expect(screen.getByText(/6 earlier days are not shown/)).toBeDefined();
  });

  it('leaves the day as the UTC string it was stored as', () => {
    render(<TrafficSection traffic={view({ days: [day(11)], since: '2026-09-11' })} />);

    // Not formatted: the column is a UTC day, and a locale format renders it in
    // the reader's zone — moving a figure to the day before for anybody west of
    // Greenwich.
    expect(screen.getByText('2026-09-11')).toBeDefined();
  });

  it('is drawn in French too', () => {
    renderIn(
      'fr',
      <TrafficSection traffic={view({ landing: 4, entry: 1, reach: 0.25 })} />,
    );

    expect(screen.getByText('Arrivées')).toBeDefined();
    expect(screen.getByText(/chargements de page, pas des personnes/)).toBeDefined();
  });
});
