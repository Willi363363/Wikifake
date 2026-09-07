/** @vitest-environment jsdom */

// The profile screen — step E.5.
//
// It formats one row and computes nothing, so what a render can hold is exactly
// that: the figures that are shown, the ones that are a dash rather than a
// zero, and the shape of the empty state. Whether the row is *right* is
// `packages/db`'s `stats.test.ts`, and whether it moves when a round is played
// is `apps/e2e/specs/profile.spec.ts`.
//
// The distinction matters here more than usual. A screen that quietly turned a
// missing average into `0` would look correct in every screenshot and be wrong
// about every new player — so "null is a dash" has its own case rather than
// being assumed from a happy path.
import { cleanup, screen } from '@testing-library/react';
import type { PlayerStats } from '@wikifake/db';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { render, renderIn } from '../i18n/testing.js';
import { Profile } from './profile.js';

vi.mock('./client.js', () => ({
  authClient: { signOut: () => Promise.resolve({}) },
  failureOf: (_: unknown, fallback: string) => fallback,
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

afterEach(() => {
  cleanup();
});

const PLAYED: PlayerStats = {
  gamesPlayed: 12,
  gamesFinished: 10,
  gamesAbandoned: 2,
  falsificationsFound: 24,
  falsificationsMissed: 6,
  paragraphsWronglyMarked: 3,
  bestScore: 640,
  averageScore: 312,
  accuracy: 24 / 30,
  currentStreak: 3,
  bestStreak: 5,
  firstSeen: new Date('2026-03-04T10:00:00.000Z'),
  lastSeen: new Date('2026-09-01T10:00:00.000Z'),
};

function show(stats: PlayerStats | null) {
  return render(<Profile pseudonym="Ada" email="ada@example.test" stats={stats} />);
}

describe('E.5 — a player who has played', () => {
  it('shows the figures the row carries', () => {
    show(PLAYED);

    expect(screen.getByRole('heading', { name: 'Ada' })).toBeDefined();
    expect(screen.getByText('10')).toBeDefined();
    expect(screen.getByText('640')).toBeDefined();
    expect(screen.getByText('312')).toBeDefined();
    // 24 of the 30 that were there. Wrongly marked paragraphs are not in the
    // denominator — `selectPlayerStats` decides that and this only renders it.
    expect(screen.getByText('80%')).toBeDefined();
  });

  it('spells out the breakdown rather than making a player subtract', () => {
    show(PLAYED);

    expect(
      screen.getByText(/24 found, 6 missed, 3 true paragraphs marked/),
    ).toBeDefined();
  });

  it('says the email is private, on the one screen that shows it', () => {
    // The promise `05-accounts.md` makes is that an address never appears in a
    // room, a leaderboard or a shared score. A player's own profile is none of
    // those, and the sentence is where it is relevant rather than in a policy.
    show(PLAYED);

    expect(screen.getByText(/ada@example.test/)).toBeDefined();
    expect(screen.getByText(/only you see this/)).toBeDefined();
  });

  it('shows a live streak, and hides it when there is none', () => {
    show(PLAYED);
    expect(screen.getByText('3 perfect rounds in a row')).toBeDefined();

    cleanup();
    show({ ...PLAYED, currentStreak: 0 });
    expect(screen.queryByText(/perfect rounds in a row/)).toBeNull();
  });
});

describe('E.5 — a figure that does not exist yet', () => {
  it('is a dash, not a zero', () => {
    /*
     * The failure this case exists for.
     *
     * A screen that rendered a missing average as `0` would look right in every
     * screenshot and be wrong about every new player — and it would be wrong in
     * the direction that reads as "you scored nothing" rather than "you have
     * not played". `selectPlayerStats` returns null on purpose; this is the
     * assertion that the null survives the journey to the page.
     */
    show({
      ...PLAYED,
      gamesFinished: 0,
      bestScore: null,
      averageScore: null,
      accuracy: null,
    });

    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(3);
  });

  it('offers a first round to an account that has never played', () => {
    show(null);

    expect(screen.getByText(/No rounds yet/)).toBeDefined();
    expect(
      screen.getByRole('link', { name: 'Play your first round' }).getAttribute('href'),
    ).toBe('/play');
  });
});

describe('E.5 — in French', () => {
  it('speaks the catalogue, and formats the numbers for the locale', () => {
    renderIn('fr', <Profile pseudonym="Ada" email="ada@example.test" stats={PLAYED} />);

    expect(screen.getByText(/Manches terminées/)).toBeDefined();
    // The point of `useFormatter` rather than `toLocaleString` with a guess:
    // a French percentage carries a non-breaking space before the sign.
    expect(screen.getByText(/80\s%/)).toBeDefined();
    expect(screen.getByText(/3 manches parfaites/)).toBeDefined();
  });
});
