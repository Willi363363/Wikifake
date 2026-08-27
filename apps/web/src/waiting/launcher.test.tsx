/** @vitest-environment jsdom */

// The launcher, and the criterion of the step: all six launch and replay, and
// nothing keeps ticking once the screen is gone.
//
// The loop below is deliberately a loop over the catalogue rather than six
// hand-written cases: a seventh game added and forgotten here would otherwise
// be a game nobody ever launches.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MINIGAMES, minigameById } from './catalogue.js';
import { PLAY_AGAIN } from './controls.js';
import { GameLauncher } from './launcher.js';

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

const advance = (ms: number): void => {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
};

const click = (name: string | RegExp): void => {
  fireEvent.click(screen.getByRole('button', { name }));
};

/**
 * How long a game has to run before it offers a way to play again.
 *
 * Four of them offer it from the start. The two arcade games offer it when they
 * end, so the clock is run until they do — which is also the only way to prove
 * they can end at all.
 */
const UNTIL_REPLAYABLE: Record<string, number> = { snake: 3000, dino: 3000 };

describe('7.6 — the catalogue', () => {
  it('holds the six games, each with its own id', () => {
    expect(MINIGAMES).toHaveLength(6);
    expect(new Set(MINIGAMES.map((game) => game.id)).size).toBe(6);
  });

  it('names every one of them', () => {
    for (const game of MINIGAMES) {
      expect(game.name.length).toBeGreaterThan(0);
      expect(game.icon.length).toBeGreaterThan(0);
    }
  });

  it('finds a game by id, and nothing by a made-up one', () => {
    expect(minigameById('snake')?.name).toBe('Snake');
    expect(minigameById('chess')).toBeUndefined();
  });
});

describe('7.6 — the launcher', () => {
  it('starts closed: a waiting screen is not a games console', () => {
    render(<GameLauncher />);
    expect(screen.getByRole('button', { name: 'Play while you wait' })).not.toBeNull();
    for (const game of MINIGAMES) {
      expect(screen.queryByText(game.name)).toBeNull();
    }
  });

  it('opens on the six, and closes again', () => {
    render(<GameLauncher />);
    click('Play while you wait');
    for (const game of MINIGAMES) {
      expect(screen.getByText(game.name)).not.toBeNull();
    }

    click('Close');
    expect(screen.getByRole('button', { name: 'Play while you wait' })).not.toBeNull();
  });

  it('offers every card to a keyboard', () => {
    render(<GameLauncher />);
    click('Play while you wait');
    // The current launcher builds its cards out of `<div onClick>`, which no
    // keyboard can reach and no screen reader announces as anything.
    for (const game of MINIGAMES) {
      expect(screen.getByRole('button', { name: game.name })).not.toBeNull();
    }
  });

  it.each(MINIGAMES.map((game) => [game.name, game.id] as const))(
    'launches and replays %s',
    (name, id) => {
      render(<GameLauncher />);
      click('Play while you wait');
      click(name);

      // The header of the game being played, which the grid no longer shows.
      expect(screen.getByText(name)).not.toBeNull();

      advance(UNTIL_REPLAYABLE[id] ?? 0);
      click(PLAY_AGAIN);
      // Still the same game, and still playable: replay is a fresh round, not a
      // trip back to the grid.
      expect(screen.getByText(name)).not.toBeNull();
      expect(screen.queryByRole('button', { name: 'Play while you wait' })).toBeNull();
    },
  );

  it.each(MINIGAMES.map((game) => [game.name] as const))(
    'goes back to the grid from %s',
    (name) => {
      render(<GameLauncher />);
      click('Play while you wait');
      click(name);
      click('← Games');

      for (const game of MINIGAMES) {
        expect(screen.getByRole('button', { name: game.name })).not.toBeNull();
      }
    },
  );

  it('mounts one game at a time', () => {
    render(<GameLauncher />);
    click('Play while you wait');
    click('Snake');
    // Six games behind a grid would be six sets of intervals for a screen whose
    // whole job is to wait on a network call.
    expect(screen.queryByLabelText('Jump')).toBeNull();
    expect(screen.queryByLabelText('Memory cards')).toBeNull();
  });

  // The completion criterion of the step, once per game.
  it.each(MINIGAMES.map((game) => [game.name, game.id] as const))(
    'leaves no timer behind when %s is unmounted',
    (name, id) => {
      const { unmount } = render(<GameLauncher />);
      click('Play while you wait');
      click(name);
      // Long enough for every clock the game owns to have started, and for the
      // two arcade games to have ended and scheduled whatever an ending
      // schedules.
      advance(UNTIL_REPLAYABLE[id] ?? 2500);

      unmount();
      act(() => {
        vi.advanceTimersByTime(60_000);
      });
      expect(vi.getTimerCount()).toBe(0);
    },
  );

  it('leaves no timer behind when a game is left for the grid', () => {
    render(<GameLauncher />);
    click('Play while you wait');
    click('Agent Dash');
    advance(1000);

    click('← Games');
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(vi.getTimerCount()).toBe(0);
  });
});
