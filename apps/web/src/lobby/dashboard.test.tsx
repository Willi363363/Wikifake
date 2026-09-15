/** @vitest-environment jsdom */

// The home — step L.6.
//
// Two audiences share one grid, and the thing worth asserting is that they share
// the *places* rather than the contents: a returning player's figures and a
// first visitor's sentences arrive in the same cells. A dashboard that dropped
// tiles for a guest would be a different arrangement from the one chosen.
//
// The other half is the rule the whole reader is built around: **a guest gets
// the null of every field, not zeroes.** A tile saying `0` under *average score*
// tells somebody they are bad at the game rather than that they have not played
// it, and that is the failure this suite exists to catch.
import { cleanup, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Dashboard } from './dashboard.js';
import { render, renderIn } from '../i18n/testing.js';
import type { HomeView } from './home.js';

// The Play tile is `LobbyEntry`, which is a client component that navigates.
// Its own suite drives the navigation; here it only has to mount, so the router
// is a stub rather than a fixture with behaviour nothing asserts.
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => undefined }) }));

afterEach(() => {
  cleanup();
});

const AT = new Date('2026-09-10T12:00:00.000Z');

/** N.7 — a day nobody has made yet: the tile says so rather than inviting a round. */
const NO_DAY = {
  day: 20_706,
  topic: null,
  played: false,
  rank: null,
  score: null,
  players: 0,
};

const EMPTY: HomeView = {
  stats: null,
  daily: null,
  board: [],
  recent: [],
  today: NO_DAY,
};

const PLAYED: HomeView = {
  // Not 'Chat', which the recent rounds below already use: the same title in
  // two sections is fine on a real dashboard — today's article and a round
  // somebody played are both article titles — but a fixture that collides makes
  // every `getByText` in this file ambiguous.
  today: { ...NO_DAY, topic: 'Tour Eiffel', players: 41 },
  stats: { gamesFinished: 12, averageScore: 74, currentStreak: 3 },
  daily: {
    questId: 'q1',
    ruleId: 'DAILY_FINISH_ROUNDS',
    period: 'daily',
    periodIndex: 0,
    target: 3,
    progress: 1,
    complete: false,
    reward: 20,
    claimedAt: null,
  },
  board: [
    { displayName: 'Ada', score: 900 },
    { displayName: 'Bob', score: 640 },
  ],
  recent: [{ gameId: 'g1', topic: 'Chat', score: 80, endedAt: AT }],
};

describe('L.6 — the home a returning player sees', () => {
  it('shows the figures, the daily quest and what was played', () => {
    render(<Dashboard home={PLAYED} signedIn pseudonym="Zoe" />);

    expect(screen.getByText('12')).not.toBeNull();
    expect(screen.getByText('74')).not.toBeNull();
    expect(screen.getByText('Chat')).not.toBeNull();
    expect(screen.getByText('1 of 3')).not.toBeNull();
  });

  it('puts Play in the grid as the largest tile, not as a banner above it', () => {
    // The decision the arrangement was chosen for, and the one a re-skin would
    // quietly undo: two columns and two rows, in the same grid as the figures.
    const { container } = render(<Dashboard home={PLAYED} signedIn pseudonym="Zoe" />);

    const play = container.querySelector('section.bg-accent');
    expect(play?.className).toContain('sm:col-span-2');
    expect(play?.className).toContain('sm:row-span-2');
  });
});

describe('L.6 — the home a first visitor sees', () => {
  it('draws no zeroes where it has no figures', () => {
    // The whole reason `HomeView` is nulls rather than numbers.
    const { container } = render(<Dashboard home={EMPTY} signedIn={false} />);

    expect(screen.queryByText('0')).toBeNull();
    expect(container.textContent).toContain('No account needed to play');
  });

  it('keeps every tile, and offers the account in the one that has nothing', () => {
    render(<Dashboard home={EMPTY} signedIn={false} />);

    expect(
      screen.getByRole('link', { name: 'Create an account, or sign in' }),
    ).not.toBeNull();
    expect(screen.getByRole('link', { name: 'All the boards' })).not.toBeNull();
    // Still the way in, for somebody who has never played: the tile is the form.
    expect(screen.getByRole('tab', { name: 'Solo' })).not.toBeNull();
  });

  it('sends a signed-in player with no rounds to their profile instead', () => {
    render(<Dashboard home={EMPTY} signedIn pseudonym="Zoe" />);

    expect(
      screen.queryByRole('link', { name: 'Create an account, or sign in' }),
    ).toBeNull();
    expect(screen.getByRole('link', { name: 'Your profile' })).not.toBeNull();
  });

  it('says the board is empty rather than showing a board of nobody', () => {
    render(<Dashboard home={EMPTY} signedIn={false} />);

    expect(screen.getByText(/Nobody has finished a room round yet/)).not.toBeNull();
  });

  it('speaks French under the French catalogue', () => {
    renderIn('fr', <Dashboard home={PLAYED} signedIn pseudonym="Zoe" />);

    expect(screen.getByText('Score moyen')).not.toBeNull();
    expect(screen.getByRole('link', { name: 'Tous les classements' })).not.toBeNull();
  });
});
