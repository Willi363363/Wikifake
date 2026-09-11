/** @vitest-environment jsdom */

// Rounds, and where they are lost — step I.5, on the screen.
//
// The abandon rate is the column worth reading, so most of these cases are
// about the two things that make it honest: **an em dash when no round has
// ended**, and the footnote saying what the figure counts and what it cannot be
// split by.
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

describe('I.5 — the rate, and the table under it', () => {
  it('leads with the overall abandon rate', () => {
    render(<GamesSection games={view()} />);

    expect(screen.getAllByText('26.2%').length).toBeGreaterThan(0);
    // Both the headline's own explanation and the footnote say it, which is
    // the point: the denominator is the thing a reader must not guess at.
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

    expect(screen.getAllByText('—')).toHaveLength(4);
    expect(screen.queryByText('0%')).toBeNull();
  });

  it('gives every mode a row, and a total below them', () => {
    render(<GamesSection games={view()} />);

    const rows = screen.getAllByRole('row').map((r) => r.textContent);
    expect(rows[1]).toContain('Solo');
    expect(rows[2]).toContain('Rooms');
    expect(rows[3]).toContain('All');
  });

  it('shows rounds still open apart from seats counted', () => {
    // The two numbers whose difference explains why the denominator is what it
    // is: three rounds are still running and contribute no seats.
    render(<GamesSection games={view()} />);

    const solo = screen.getAllByRole('row')[1]?.textContent;
    expect(solo).toContain('40');
    expect(solo).toContain('38');
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
    expect(screen.getByText('Salons')).not.toBeNull();
    expect(screen.getByText(/ventilé par écran/)).not.toBeNull();
  });
});
