/** @vitest-environment jsdom */

// Arrivals — step K.6, on the screen.
//
// Amended rather than rewritten when the section became a page. Every claim
// J.4b made is still a claim about the digest; what moved is where each one is
// said, so the queries are scoped to the tile or the card rather than to the
// whole page — the one-step funnel repeats *Landing* and *Entry screen*, which
// is what it is for.
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

/** What one tile says, label included — the first match is the tile row. */
function tile(label: string): string {
  return screen.getAllByText(label)[0]?.parentElement?.textContent ?? '';
}

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

describe('K.6 — the arrivals page', () => {
  it('leads with the ratio, and shows what it divided', () => {
    render(<TrafficSection traffic={view({ landing: 40, entry: 10, reach: 0.25 })} />);

    // Read off the tiles rather than off the page: the one-step funnel below
    // prints the same two counts, which is what it is for, and a test that
    // passes on the wrong element stops noticing when the right one goes.
    expect(tile('Reach')).toContain('25%');
    expect(tile('Landing')).toContain('40');
    expect(tile('Entry screen')).toContain('10');
  });

  it('names the loss between the two, rather than leaving it to be subtracted', () => {
    // The candidate the owner asked for beside the digest: the page measures
    // one step, and the number worth reading is the one that fell out of it.
    render(<TrafficSection traffic={view({ landing: 40, entry: 10, reach: 0.25 })} />);

    expect(
      screen.getByText('30 landing loads did not reach the entry screen'),
    ).toBeDefined();
  });

  it('does not draw a bar wider than its own container when reach passes 100%', () => {
    // Reach above one is not a defect: the entry screen is reachable from a
    // bookmark without the landing. The figure says so and the bar is clamped,
    // because a bar overflowing its row would say the opposite.
    const { container } = render(
      <TrafficSection traffic={view({ landing: 10, entry: 25, reach: 2.5 })} />,
    );

    expect(tile('Reach')).toContain('250%');
    for (const bar of container.querySelectorAll<HTMLElement>('[style*="width"]')) {
      expect(bar.style.width).not.toContain('250%');
    }
  });

  /*
   * An em dash, not 0%.
   *
   * A reach of zero says the landing failed. Nobody arrived says nothing about
   * the landing at all, and printing 0% for it is the panel inventing a finding.
   */
  it('prints an em dash when there is nothing to divide', () => {
    render(<TrafficSection traffic={view()} />);

    expect(tile('Reach')).toContain('—');
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
    // The chart beside the table draws every day the period has, so the cap is
    // a property of the rows and not of the measurement.
    expect(screen.getAllByTitle(/2026-09/)).toHaveLength(40);
  });

  it('leaves the day as the UTC string it was stored as', () => {
    render(<TrafficSection traffic={view({ days: [day(11)], since: '2026-09-11' })} />);

    // Not formatted: the column is a UTC day, and a locale format renders it in
    // the reader's zone — moving a figure to the day before for anybody west of
    // Greenwich.
    expect(screen.getAllByText('2026-09-11').length).toBeGreaterThan(0);
    expect(tile('Counting since')).toContain('2026-09-11');
  });

  it('is drawn in French too', () => {
    renderIn(
      'fr',
      <TrafficSection traffic={view({ landing: 4, entry: 1, reach: 0.25 })} />,
    );

    // The page's own name is the chassis heading now (`page-heading.tsx`), so
    // what this asserts is the body.
    expect(screen.getByText('Accueil → entrée')).toBeDefined();
    expect(screen.getByText(/chargements de page, pas des personnes/)).toBeDefined();
  });
});
