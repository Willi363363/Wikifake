/** @vitest-environment jsdom */

// The players section — step I.3.
//
// It formats five figures and a short list, and the thing worth testing is the
// **pairing**: a number on its own teaches nothing, which is the track's own
// complaint about vanity metrics. Accounts beside guests, and ever-played
// beside accounts, are the two pairs that make this section say something.
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

describe('I.3 — the figures, and what each is beside', () => {
  it('shows accounts with the guests kept apart', () => {
    // A guest is a `user` row too, so a panel that added them together would
    // report sign-ups that are not.
    render(<PlayersSection players={view()} />);

    expect(screen.getByText('120')).not.toBeNull();
    expect(screen.getByText('43 guests besides')).not.toBeNull();
  });

  it('shows ever-played against the accounts it is a fraction of', () => {
    render(<PlayersSection players={view()} />);

    expect(screen.getByText('71')).not.toBeNull();
    expect(screen.getByText('of 120 accounts')).not.toBeNull();
  });

  it('says "no guests" rather than a bare zero', () => {
    render(<PlayersSection players={view({ guests: 0 })} />);

    expect(screen.getByText('no guests')).not.toBeNull();
  });

  it('shows today, and the range, with this week beside it', () => {
    // I.8 — *seen since* is a range on `last_seen`, so this figure moves with
    // the chooser. This week stays beside it as the fixed comparison.
    render(<PlayersSection players={view()} />);

    expect(screen.getByText('Active today')).not.toBeNull();
    expect(screen.getByText('9')).not.toBeNull();
    expect(screen.getByText('Active in range')).not.toBeNull();
    expect(screen.getByText('51')).not.toBeNull();
    expect(screen.getByText('34 this week')).not.toBeNull();
  });

  it('says the most-active list cannot honour the range', () => {
    // `games_finished` is a running total with no date on it, so a list that
    // looked ranged would be a list that lied.
    render(<PlayersSection players={view()} />);

    expect(screen.getByText(/running total with no date on it/)).not.toBeNull();
  });
});

describe('I.3 — the most active', () => {
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

    const cells = screen.getAllByRole('cell').map((cell) => cell.textContent);
    expect(cells.slice(0, 3)).toEqual(['Ada', '28', '30']);
    expect(cells.slice(4, 7)).toEqual(['Bob', '11', '40']);
  });

  it('says so when nobody has finished a round', () => {
    render(<PlayersSection players={view({ mostActive: [] })} />);

    expect(screen.getByText('Nobody has finished a round yet.')).not.toBeNull();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('says the same things in French', () => {
    renderIn('fr', <PlayersSection players={view()} />);

    expect(screen.getByText('Joueurs')).not.toBeNull();
    expect(screen.getByText('43 invités en plus')).not.toBeNull();
    expect(screen.getByText('Les plus assidus')).not.toBeNull();
  });
});
