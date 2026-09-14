/** @vitest-environment jsdom */

// Rounds, and where they are lost — step K.7, on the screen.
//
// Amended when the table became two cards. Every claim I.5 made survives the
// shape — the em dash when no round has ended, the two counts whose difference
// explains the denominator, the footnote about what cannot be split by screen —
// and one is added: **the comparison is the page**, so solo and rooms have to
// be two regions a reader can tell apart rather than two rows.
//
// The abandon rate is still the figure worth reading, so most of these cases
// are about what makes it honest.
import { cleanup, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { GamesSection } from './games-screen.js';
import { render, renderIn } from '../i18n/testing.js';
import type { GamesView, ModeRow } from './games.js';

afterEach(() => {
  cleanup();
});

function row(over: Partial<ModeRow> & { mode: ModeRow['mode'] }): ModeRow {
  return {
    rounds: 0,
    ended: 0,
    open: 0,
    seats: 0,
    submitted: 0,
    abandoned: 0,
    abandonRate: null,
    ...over,
  };
}

function view(over: Partial<GamesView> = {}): GamesView {
  return {
    rows: [
      row({
        mode: 'solo',
        rounds: 40,
        ended: 38,
        open: 2,
        seats: 38,
        submitted: 30,
        abandoned: 8,
        abandonRate: 8 / 38,
      }),
      row({
        mode: 'multiplayer',
        rounds: 10,
        ended: 9,
        open: 1,
        seats: 27,
        submitted: 18,
        abandoned: 9,
        abandonRate: 1 / 3,
      }),
    ],
    total: row({
      mode: 'all',
      rounds: 50,
      ended: 47,
      open: 3,
      seats: 65,
      submitted: 48,
      abandoned: 17,
      abandonRate: 17 / 65,
    }),
    ...over,
  };
}

describe('K.7 — the rate, and the two cards it is split across', () => {
  it('leads with the overall abandon rate', () => {
    render(<GamesSection games={view()} />);

    expect(screen.getByRole('region', { name: 'Both modes' }).textContent).toContain(
      '26.2%',
    );
    // Both the rate's own explanation and the footnote say what it is a share
    // of, which is the point: the denominator is what a reader must not guess.
    expect(screen.getAllByText(/rounds that have ended/)).toHaveLength(2);
  });

  it('shows an em dash rather than 0% when no round has ended', () => {
    // No rounds have ended is not "nobody abandoned one".
    render(
      <GamesSection
        games={view({
          rows: [row({ mode: 'solo' }), row({ mode: 'multiplayer' })],
          total: row({ mode: 'all' }),
        })}
      />,
    );

    // Three em dashes: one on each mode card, one on the strip for both. The
    // fourth in I.5's table was the `all` row, which is now that strip.
    expect(screen.getAllByText('—')).toHaveLength(3);
    expect(screen.queryByText('0%')).toBeNull();
  });

  it('gives every mode a region of its own, and both a strip below them', () => {
    // Two games, not two slices of one number: a table made the reader do the
    // comparison the page exists for, and two cards do it by being beside each
    // other. Named regions, so a screen reader gets the same split.
    render(<GamesSection games={view()} />);

    const named = screen
      .getAllByRole('region')
      .map((region) => region.getAttribute('aria-label'));
    expect(named).toEqual(['Solo', 'Rooms', 'Both modes']);
  });

  it('shows rounds still open apart from seats counted', () => {
    // The two numbers whose difference explains why the denominator is what it
    // is: two solo rounds are still running and contribute no seats.
    render(<GamesSection games={view()} />);

    const solo = screen.getByRole('region', { name: 'Solo' }).textContent ?? '';
    expect(solo).toContain('40');
    expect(solo).toContain('2 still running');
    expect(solo).toContain('30 submitted');
  });

  it('keeps each mode’s rate on its own card, never averaged into one', () => {
    // 21.1% and 33.3% are different games. A page that showed only the 26.2%
    // they average to would hide the fact the page is for.
    render(<GamesSection games={view()} />);

    expect(screen.getByRole('region', { name: 'Solo' }).textContent).toContain('21.1%');
    expect(screen.getByRole('region', { name: 'Rooms' }).textContent).toContain('33.3%');
  });

  it('says what the rate counts, and what it cannot be split by', () => {
    // The track asked for "by screen", and the screens before a round exists
    // leave no row. Saying so beats a column that quietly means something else.
    render(<GamesSection games={view()} />);

    expect(screen.getByText(/has not abandoned anything/)).not.toBeNull();
    expect(screen.getByText(/cannot be split by screen/)).not.toBeNull();
  });

  it('says the same things in French', () => {
    renderIn('fr', <GamesSection games={view()} />);

    expect(screen.getByText('Taux d’abandon')).not.toBeNull();
    expect(screen.getAllByText('Salons').length).toBeGreaterThan(0);
    expect(screen.getByText('Les deux modes')).not.toBeNull();
    expect(screen.getByText(/ventilé par écran/)).not.toBeNull();
  });
});
