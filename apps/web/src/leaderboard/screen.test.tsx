/** @vitest-environment jsdom */

// The board screen — step G.5.
//
// It renders rows and two rows of links, so what a render can hold is exactly
// that: the rank being positional, the pseudonym being the only thing a row says
// about a player, the chosen tab being announced and not merely underlined, and
// the empty board saying something rather than nothing.
//
// Whether the *rows* are right is `packages/db`'s suite, and whether the plan
// holds at volume is its volume test. Neither is re-asserted here.
import { cleanup, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { BoardScreen } from './screen.js';
import { render, renderIn } from '../i18n/testing.js';
import type { BoardView } from './board.js';

afterEach(() => {
  cleanup();
});

const AT = new Date('2026-09-10T12:00:00.000Z');

function board(over: Partial<BoardView> = {}): BoardView {
  return {
    period: 'daily',
    region: null,
    players: 3,
    rows: [
      { userId: 'u1', displayName: 'Ada', score: 900, finishedAt: AT },
      { userId: 'u2', displayName: 'Bob', score: 640, finishedAt: AT },
      { userId: 'u3', displayName: 'Cléo', score: 120, finishedAt: AT },
    ],
    ...over,
  };
}

describe('G.5 — the rows', () => {
  it('numbers them by position, not by anything stored', () => {
    // G.2 stores no rank, because a rank is only true of one board at one
    // moment. The screen counts.
    render(<BoardScreen board={board()} />);

    const cells = screen.getAllByRole('cell');
    expect(cells[0]?.textContent).toBe('1');
    expect(cells[1]?.textContent).toBe('Ada');
  });

  it('shows the pseudonym and nothing else about a player', () => {
    // E.3.3's promise, on the screen it names: the email appears in no room, no
    // leaderboard and no shared score. There is no field for one here.
    const view = board();
    const { container } = render(<BoardScreen board={view} />);

    for (const row of view.rows) {
      expect(container.textContent).toContain(row.displayName);
      expect(container.textContent).not.toContain(row.userId);
    }
    expect(container.textContent).not.toContain('@');
  });

  it('keeps the order it was given', () => {
    // The screen does not sort. `boardQuery` decided the order — score, then
    // who got there first, then the identifier — and a second sort here would
    // be a second opinion about a tie.
    render(<BoardScreen board={board()} />);

    const names = screen
      .getAllByRole('row')
      .slice(1)
      .map((row) => {
        const cells = row.querySelectorAll('td');
        return cells[1]?.textContent;
      });
    expect(names).toEqual(['Ada', 'Bob', 'Cléo']);
  });
});

describe('G.5 — choosing a board', () => {
  it('offers three periods and four regions, as links', () => {
    render(<BoardScreen board={board()} />);

    for (const text of ['Today', 'This week', 'All time']) {
      expect(screen.getByRole('link', { name: text })).not.toBeNull();
    }
    for (const text of ['World', 'Europe', 'The Americas', 'Elsewhere']) {
      expect(screen.getByRole('link', { name: text })).not.toBeNull();
    }
  });

  it('announces the chosen one rather than only underlining it', () => {
    render(<BoardScreen board={board({ period: 'weekly', region: 'europe' })} />);

    // `getAttribute` rather than a jest-dom matcher: this suite does not load
    // them, and `toHaveAttribute` fails as an invalid Chai property rather than
    // as a missing attribute — which reads like the assertion, not the setup.
    const current = (name: string): string | null =>
      screen.getByRole('link', { name }).getAttribute('aria-current');

    expect(current('This week')).toBe('page');
    expect(current('Europe')).toBe('page');
    expect(current('Today')).toBeNull();
  });

  it('keeps the other choice when one changes', () => {
    // Each link is a whole board at its own address, so switching the period
    // must not silently send a regional viewer back to the world.
    render(<BoardScreen board={board({ period: 'daily', region: 'americas' })} />);

    const href = (name: string): string | null =>
      screen.getByRole('link', { name }).getAttribute('href');

    expect(href('All time')).toBe('/leaderboard?period=allTime&region=americas');
    expect(href('Europe')).toBe('/leaderboard?period=daily&region=europe');
  });

  it('leaves the region off the world board’s address', () => {
    // `?region=world` would be a fourth region the protocol does not have.
    render(<BoardScreen board={board({ region: 'europe' })} />);

    expect(screen.getByRole('link', { name: 'World' }).getAttribute('href')).toBe(
      '/leaderboard?period=daily',
    );
  });
});

describe('G.5 — an empty board, and what it says about solo', () => {
  it('says why it is empty and offers the way to fill it', () => {
    render(<BoardScreen board={board({ rows: [], players: 0 })} />);

    expect(screen.getByText(/No room rounds in this period yet/)).not.toBeNull();
    expect(screen.getByRole('link', { name: 'Open a room' })).not.toBeNull();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('says room rounds only, and that solo still counts', () => {
    /*
     * The owner's decision, on the screen rather than left to be inferred from
     * an empty board. A solo topic is one the player chose, so a solo score is
     * not comparable — and a player whose solo rounds are missing here needs to
     * be told they still count towards their profile, quests and streak.
     */
    render(<BoardScreen board={board()} />);

    expect(screen.getByText(/Room rounds only/)).not.toBeNull();
    expect(
      screen.getByText(/Your solo rounds still count towards your profile/),
    ).not.toBeNull();
  });

  it('speaks French under the French catalogue', () => {
    renderIn('fr', <BoardScreen board={board()} />);

    expect(screen.getByRole('heading', { name: 'Classements' })).not.toBeNull();
    expect(screen.getByRole('link', { name: 'Ailleurs' })).not.toBeNull();
    expect(screen.getByText(/Manches en salon uniquement/)).not.toBeNull();
  });
});
