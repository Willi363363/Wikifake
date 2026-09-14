/** @vitest-environment jsdom */

// Who is playing — step K.4, on the screen.
//
// Amended rather than rewritten when the section became a page: every claim
// I.3 made is still a claim about the digest, and two more arrive with it —
// the shares are percentages now, and the list gained a rank column.
//
// The thing worth testing is still the **pairing**: a number on its own teaches
// nothing, which is the track's own complaint about vanity metrics. Accounts
// beside guests, and ever-played beside accounts, are the two pairs that make
// this page say something.
//
// Whether the figures are *right* is `players.test.ts` against a real database.
import { cleanup, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { PlayersSection } from './players-screen.js';
import { render, renderIn } from '../i18n/testing.js';
import type { PlayersView } from './players.js';

afterEach(() => {
  cleanup();
});

const AT = new Date('2026-09-10T15:00:00Z');

function view(over: Partial<PlayersView> = {}): PlayersView {
  return {
    accounts: 120,
    guests: 43,
    everPlayed: 71,
    activeToday: 9,
    activeThisWeek: 34,
    activeInRange: 51,
    mostActive: [
      {
        userId: 'u1',
        displayName: 'Ada',
        gamesPlayed: 30,
        gamesFinished: 28,
        lastSeen: AT,
      },
      {
        userId: 'u2',
        displayName: 'Bob',
        gamesPlayed: 40,
        gamesFinished: 11,
        lastSeen: AT,
      },
    ],
    ...over,
  };
}

describe('K.4 — the figures, and what each is beside', () => {
  it('shows accounts with the guests kept apart', () => {
    // A guest is a `user` row too, so a panel that added them together would
    // report sign-ups that are not.
    render(<PlayersSection players={view()} />);

    expect(screen.getByText('120')).not.toBeNull();
    expect(screen.getByText('43 guests besides')).not.toBeNull();
  });

  it('shows ever-played against the accounts it is a fraction of', () => {
    render(<PlayersSection players={view()} />);

    // A share and not a raw denominator: K.4's tiles are read at a glance, and
    // "of 120 accounts" makes the reader do the division the tile exists for.
    expect(screen.getByText('71')).not.toBeNull();
    expect(screen.getByText('59.2% of accounts')).not.toBeNull();
  });

  it('says "no guests" rather than a bare zero', () => {
    render(<PlayersSection players={view({ guests: 0 })} />);

    expect(screen.getByText('no guests')).not.toBeNull();
  });

  it('shows today, and the period, with this week beside it', () => {
    // *Seen since* is a range on `last_seen`, the one dated column
    // `player_stats` has, so this figure moves with the bar. This week stays
    // beside today as the fixed comparison neither of them moves.
    render(<PlayersSection players={view()} />);

    expect(screen.getByText('Active today')).not.toBeNull();
    expect(screen.getByText('9')).not.toBeNull();
    expect(screen.getByText('Active in period')).not.toBeNull();
    expect(screen.getByText('51')).not.toBeNull();
    expect(screen.getByText('34 this week')).not.toBeNull();
  });

  it('falls back to a count when there is no account to be a share of', () => {
    // `shareOf`'s rule at the tile: dividing by nothing is not nought per cent,
    // and a digest reading 0 % the day before launch would report a failure
    // that has not happened.
    render(
      <PlayersSection
        players={view({ accounts: 0, everPlayed: 0, activeInRange: 0, mostActive: [] })}
      />,
    );

    expect(screen.queryByText(/0% of accounts/)).toBeNull();
    expect(screen.getAllByText('of 0 accounts')).toHaveLength(2);
  });

  it('says the most-active list cannot honour the range', () => {
    // `games_finished` is a running total with no date on it, so a list that
    // looked ranged would be a list that lied.
    render(<PlayersSection players={view()} />);

    expect(screen.getByText(/running total with no date on it/)).not.toBeNull();
  });
});

describe('K.4 — the most active', () => {
  it('lists a pseudonym, and nothing else about a player', () => {
    // E.3.3's promise holds on the admin panel too.
    render(<PlayersSection players={view()} />);

    expect(screen.getByText('Ada')).not.toBeNull();
    expect(screen.queryByText(/@example/)).toBeNull();
    expect(screen.queryByText('u1')).toBeNull();
  });

  it('shows started beside finished, so the gap is visible on the row', () => {
    // That gap is what I.5 will call the abandon rate, and a reader should not
    // have to compute it to notice it.
    render(<PlayersSection players={view()} />);

    // Five columns now: K.4's digest numbers the rows, so the shape of the
    // tail is readable without counting down the list.
    const cells = screen.getAllByRole('cell').map((cell) => cell.textContent);
    expect(cells.slice(0, 4)).toEqual(['1', 'Ada', '28', '30']);
    expect(cells.slice(5, 9)).toEqual(['2', 'Bob', '11', '40']);
  });

  it('says so when nobody has finished a round', () => {
    render(<PlayersSection players={view({ mostActive: [] })} />);

    expect(screen.getByText('Nobody has finished a round yet.')).not.toBeNull();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('says the same things in French', () => {
    // The page's own name is the chassis heading now (`page-heading.tsx`), so
    // what this asserts is the body: the figures and the list.
    renderIn('fr', <PlayersSection players={view()} />);

    expect(screen.getByText('43 invités en plus')).not.toBeNull();
    expect(screen.getByText('Les plus assidus')).not.toBeNull();
    expect(screen.getByText('59,2 % des comptes')).not.toBeNull();
  });
});
