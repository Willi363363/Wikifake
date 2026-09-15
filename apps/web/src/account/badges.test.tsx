/** @vitest-environment jsdom */

// The badges section — step M.2.
//
// It renders and computes nothing: what is held, which rung is next and what a
// metric reads are all `@wikifake/domain`, and `badges.test.ts` over there holds
// them. What a render can hold is the part that is this file's — the order of
// the two questions, and the one case where showing the metric would lie.
import { cleanup, screen, within } from '@testing-library/react';
import type { BadgeStats } from '@wikifake/domain';
import { afterEach, describe, expect, it } from 'vitest';

import { Badges } from './badges.js';
import { render } from '../i18n/testing.js';

afterEach(() => {
  cleanup();
});

function stats(over: Partial<BadgeStats> = {}): BadgeStats {
  return {
    gamesFinished: 0,
    falsificationsFound: 0,
    bestScore: null,
    bestStreak: 0,
    accuracy: null,
    ...over,
  };
}

describe('M.2 — what a player holds', () => {
  it('says so rather than showing an empty row of nothing', () => {
    render(<Badges stats={stats()} />);

    expect(screen.getByText('Finish a round and the first one is yours.')).toBeTruthy();
    expect(screen.getByText('0 of 15')).toBeTruthy();
  });

  it('names every badge held, and counts them', () => {
    render(<Badges stats={stats({ gamesFinished: 12, falsificationsFound: 30 })} />);

    expect(screen.getByText('First round')).toBeTruthy();
    expect(screen.getByText('Ten rounds')).toBeTruthy();
    expect(screen.getByText('Twenty-five caught')).toBeTruthy();
    expect(screen.getByText('3 of 15')).toBeTruthy();
  });

  /*
   * Asked of the chip list rather than of the document, and that is the point
   * of the `aria-label`: "Fifty rounds" is on the screen either way now — as the
   * rung being climbed towards. What must not happen is it appearing among the
   * badges held.
   */
  it('does not count a badge that is not held among the ones held', () => {
    render(<Badges stats={stats({ gamesFinished: 12 })} />);

    const held = screen.getByRole('list', { name: 'Badges' });

    expect(within(held).queryByText('Fifty rounds')).toBeNull();
    expect(within(held).getByText('Ten rounds')).toBeTruthy();
  });
});

describe('M.2 — the rung underneath', () => {
  it('shows how far off the next one is', () => {
    render(<Badges stats={stats({ gamesFinished: 12 })} />);

    expect(screen.getByText('12 / 50')).toBeTruthy();
  });

  // A finished ladder has no row: every row names a rung being climbed, so one
  // with nothing above it has nothing to say.
  it('drops a ladder that is finished rather than printing a rung that is not there', () => {
    render(<Badges stats={stats({ gamesFinished: 5000 })} />);

    const next = screen.getByRole('region', { name: 'Next' });

    // Held, so it is a chip — and therefore on the screen, which is why this is
    // asked of the Next section rather than of the document.
    expect(screen.getByText('Two hundred rounds')).toBeTruthy();
    expect(within(next).queryByText('Two hundred rounds')).toBeNull();
    expect(within(next).getByText('Twenty-five caught')).toBeTruthy();
  });

  it('says so when every rung is held', () => {
    const everything = stats({
      gamesFinished: 5000,
      falsificationsFound: 5000,
      bestScore: 5000,
      bestStreak: 5000,
      accuracy: 1,
    });
    render(<Badges stats={everything} />);

    expect(screen.getByText('Every rung is yours.')).toBeTruthy();
    expect(screen.getByText('15 of 15')).toBeTruthy();
  });

  /*
   * The case the whole of `gapTo` exists for. A player at 80% over five rounds
   * does not hold ACCURACY_75 — the floor is twenty finished rounds — and a row
   * reading `80% / 75%` would tell them they had earned something they had not.
   * What is actually in their way is the five.
   */
  it('shows the floor, not the ratio, when the floor is what is missing', () => {
    render(<Badges stats={stats({ gamesFinished: 5, accuracy: 0.8 })} />);

    expect(screen.getByText('5 / 20 rounds')).toBeTruthy();
    expect(screen.queryByText('80% / 75%')).toBeNull();
  });

  it('shows the ratio once the floor is cleared', () => {
    render(<Badges stats={stats({ gamesFinished: 40, accuracy: 0.8 })} />);

    expect(screen.getByText('80% / 90%')).toBeTruthy();
  });
});
