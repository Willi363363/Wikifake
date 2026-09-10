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

import { BOARD_MIN_PLAYERS } from './board.js';
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
    // Open by default, because G.6's threshold is its own describe below and
    // every case above it is about a board that has rows to show.
    players: BOARD_MIN_PLAYERS,
    open: true,
    // Nobody asking, by default: G.7's own-rank block is its own describe.
    own: null,
    around: [],
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
    // `open: false` because that is what `readBoard` returns for nobody at all:
    // G.6 made zero players a *closed* board rather than an empty table, so
    // this case now describes the state the read path actually produces.
    render(<BoardScreen board={board({ rows: [], players: 0, open: false })} />);

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

describe('G.6 — a board with too few players', () => {
  it('says nothing about who is on it', () => {
    /*
     * The track's rule: *"a leaderboard with four entries makes a game look
     * abandoned… under it, the screen says the ranking opens soon rather than
     * showing three names."*
     *
     * `readBoard` withholds the rows below the threshold, so this renders what
     * a closed board actually arrives as — no rows at all — rather than a full
     * board the screen chose to hide.
     */
    render(<BoardScreen board={board({ players: 4, open: false, rows: [] })} />);

    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.getByText(/This ranking opens once 10 players/)).not.toBeNull();
  });

  it('says how many players there are, which is a count and not a name', () => {
    render(<BoardScreen board={board({ players: 4, open: false, rows: [] })} />);

    expect(screen.getByText('4 players so far')).not.toBeNull();
  });

  it('reads the threshold from the one place it is written', () => {
    // The sentence interpolates `BOARD_MIN_PLAYERS`, so changing the number
    // changes the promise. A hard-coded ten in the catalogue would be a screen
    // promising a threshold nothing enforces.
    render(<BoardScreen board={board({ players: 1, open: false, rows: [] })} />);

    expect(
      screen.getByText(new RegExp(`opens once ${String(BOARD_MIN_PLAYERS)} players`)),
    ).not.toBeNull();
    expect(screen.getByText('1 player so far')).not.toBeNull();
  });

  it('invites the first player rather than promising them a threshold', () => {
    // Zero and "some but not enough" are different things to a player: one is
    // an invitation, the other a promise with a number.
    render(<BoardScreen board={board({ players: 0, open: false, rows: [] })} />);

    expect(screen.getByText(/No room rounds in this period yet/)).not.toBeNull();
    expect(screen.queryByText(/This ranking opens once/)).toBeNull();
  });

  it('points at the all-time board, which fills up first', () => {
    // The same ten players, but every period to find them in. Not offered when
    // it is the board being looked at.
    render(
      <BoardScreen
        board={board({ period: 'daily', players: 4, open: false, rows: [] })}
      />,
    );

    expect(
      screen
        .getByRole('link', { name: /The all-time board fills up first/ })
        .getAttribute('href'),
    ).toBe('/leaderboard?period=allTime');

    cleanup();
    render(
      <BoardScreen
        board={board({ period: 'allTime', players: 4, open: false, rows: [] })}
      />,
    );
    expect(screen.queryByText(/The all-time board fills up first/)).toBeNull();
  });

  it('shows the choosers, so a closed board is not a dead end', () => {
    // A player looking at a closed daily board must be able to reach the
    // all-time one, and the region tabs go on working.
    render(<BoardScreen board={board({ players: 4, open: false, rows: [] })} />);

    expect(screen.getByRole('link', { name: 'All time' })).not.toBeNull();
    expect(screen.getByRole('link', { name: 'Europe' })).not.toBeNull();
  });

  it('speaks French about a closed board too', () => {
    renderIn('fr', <BoardScreen board={board({ players: 4, open: false, rows: [] })} />);

    expect(screen.getByText(/Ce classement ouvre dès que 10 joueurs/)).not.toBeNull();
    expect(screen.getByText('4 joueurs pour l’instant')).not.toBeNull();
  });
});

describe('G.7 — where the viewer stands', () => {
  const rows = [
    { userId: 'u1', displayName: 'Ada', score: 900, finishedAt: AT },
    { userId: 'u2', displayName: 'Bob', score: 640, finishedAt: AT },
  ];

  it('marks the viewer’s own row when they are on the page', () => {
    // Announced and not only coloured: `aria-current` is how a screen reader
    // learns which row is yours, and the wash is for everybody else.
    render(
      <BoardScreen
        board={board({
          rows,
          own: { userId: 'u2', rank: 2, score: 640, finishedAt: AT },
        })}
      />,
    );

    const marked = screen
      .getAllByRole('row')
      .filter((row) => row.getAttribute('aria-current') === 'true');

    expect(marked).toHaveLength(1);
    expect(marked[0]?.textContent).toContain('Bob');
  });

  it('says nothing twice when the viewer is already on the page', () => {
    // `around` is empty for a player inside the page, so there is no second
    // block. A screen repeating their row would say the same thing twice.
    render(
      <BoardScreen
        board={board({
          rows,
          own: { userId: 'u2', rank: 2, score: 640, finishedAt: AT },
          around: [],
        })}
      />,
    );

    expect(screen.queryByText(/Your rank/)).toBeNull();
    expect(screen.getAllByRole('table')).toHaveLength(1);
  });

  it('shows a block with the neighbours when the viewer is off the page', () => {
    render(
      <BoardScreen
        board={board({
          rows,
          own: { userId: 'me', rank: 137, score: 90, finishedAt: AT },
          around: [
            { userId: 'x', displayName: 'Above', score: 95, finishedAt: AT },
            { userId: 'me', displayName: 'Me', score: 90, finishedAt: AT },
            { userId: 'y', displayName: 'Below', score: 85, finishedAt: AT },
          ],
        })}
      />,
    );

    expect(screen.getByText('Your rank: 137')).not.toBeNull();
    // The ranks either side are counted from the viewer's, not from one.
    const block = screen.getAllByRole('table')[1] as HTMLElement;
    const numbers = [...block.querySelectorAll('td:first-child')].map(
      (cell) => cell.textContent,
    );
    expect(numbers).toEqual(['136', '137', '138']);
  });

  it('marks the viewer inside that block too', () => {
    render(
      <BoardScreen
        board={board({
          rows,
          own: { userId: 'me', rank: 137, score: 90, finishedAt: AT },
          around: [
            { userId: 'x', displayName: 'Above', score: 95, finishedAt: AT },
            { userId: 'me', displayName: 'Me', score: 90, finishedAt: AT },
          ],
        })}
      />,
    );

    const marked = screen
      .getAllByRole('row')
      .filter((row) => row.getAttribute('aria-current') === 'true');
    expect(marked).toHaveLength(1);
    expect(marked[0]?.textContent).toContain('Me');
  });

  it('says nothing about a rank on a closed board', () => {
    // The trap G.6 flagged for this step: a rank on a closed board would leak
    // the ranking the threshold exists to hide, and to exactly the player most
    // likely to share it. `readBoard` returns `own: null` there, and this is the
    // screen agreeing.
    render(
      <BoardScreen board={board({ players: 4, open: false, rows: [], own: null })} />,
    );

    expect(screen.queryByText(/Your rank/)).toBeNull();
  });

  it('says nothing about a rank to somebody who is not on the board', () => {
    render(<BoardScreen board={board({ rows, own: null, around: [] })} />);

    expect(screen.queryByText(/Your rank/)).toBeNull();
    expect(
      screen.getAllByRole('row').filter((row) => row.getAttribute('aria-current')),
    ).toEqual([]);
  });
});
