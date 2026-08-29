/** @vitest-environment jsdom */

// The launcher, and the criterion of the step: all six launch and replay, and
// nothing keeps ticking once the screen is gone.
//
// The loop below is deliberately a loop over the catalogue rather than six
// hand-written cases: a seventh game added and forgotten here would otherwise
// be a game nobody ever launches.
import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MINIGAMES, minigameById, type MinigameId } from './catalogue.js';
import { GameLauncher } from './launcher.js';
import { Snake } from './snake.js';
import { render } from '../i18n/testing.js';
import en from '../../messages/en/waiting.json';

/** What the player reads: since 11.2 the names live in the catalogue. */
const nameOf = (id: MinigameId): string => en.games[id].name;

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
      expect(nameOf(game.id).length).toBeGreaterThan(0);
      expect(game.icon.length).toBeGreaterThan(0);
    }
  });

  it('finds a game by id, and nothing by a made-up one', () => {
    expect(minigameById('snake')?.Play).toBe(Snake);
    expect(minigameById('chess')).toBeUndefined();
  });
});

describe('7.6 — the launcher', () => {
  it('starts closed: a waiting screen is not a games console', () => {
    render(<GameLauncher />);
    expect(screen.getByRole('button', { name: en.launcher.open })).not.toBeNull();
    for (const game of MINIGAMES) {
      expect(screen.queryByText(nameOf(game.id))).toBeNull();
    }
  });

  it('opens on the six, and closes again', () => {
    render(<GameLauncher />);
    click(en.launcher.open);
    for (const game of MINIGAMES) {
      expect(screen.getByText(nameOf(game.id))).not.toBeNull();
    }

    click(en.launcher.close);
    expect(screen.getByRole('button', { name: en.launcher.open })).not.toBeNull();
  });

  it('offers every card to a keyboard', () => {
    render(<GameLauncher />);
    click(en.launcher.open);
    // The current launcher builds its cards out of `<div onClick>`, which no
    // keyboard can reach and no screen reader announces as anything.
    for (const game of MINIGAMES) {
      expect(screen.getByRole('button', { name: nameOf(game.id) })).not.toBeNull();
    }
  });

  it.each(MINIGAMES.map((game) => [nameOf(game.id), game.id] as const))(
    'launches and replays %s',
    (name, id) => {
      render(<GameLauncher />);
      click(en.launcher.open);
      click(name);

      // The header of the game being played, which the grid no longer shows.
      expect(screen.getByText(name)).not.toBeNull();

      advance(UNTIL_REPLAYABLE[id] ?? 0);
      click(en.controls.playAgain);
      // Still the same game, and still playable: replay is a fresh round, not a
      // trip back to the grid.
      expect(screen.getByText(name)).not.toBeNull();
      expect(screen.queryByRole('button', { name: en.launcher.open })).toBeNull();
    },
  );

  it.each(MINIGAMES.map((game) => [nameOf(game.id)] as const))(
    'goes back to the grid from %s',
    (name) => {
      render(<GameLauncher />);
      click(en.launcher.open);
      click(name);
      // The arrow on the button is aria-hidden decoration, so the accessible
      // name is the catalogue's word alone.
      click(en.launcher.backToGames);

      for (const game of MINIGAMES) {
        expect(screen.getByRole('button', { name: nameOf(game.id) })).not.toBeNull();
      }
    },
  );

  it('mounts one game at a time', () => {
    render(<GameLauncher />);
    click(en.launcher.open);
    click(nameOf('snake'));
    // Six games behind a grid would be six sets of intervals for a screen whose
    // whole job is to wait on a network call.
    expect(screen.queryByLabelText(en.dino.jump)).toBeNull();
    expect(screen.queryByLabelText(en.memory.gridLabel)).toBeNull();
  });

  // The completion criterion of the step, once per game.
  it.each(MINIGAMES.map((game) => [nameOf(game.id), game.id] as const))(
    'leaves no timer behind when %s is unmounted',
    (name, id) => {
      const { unmount } = render(<GameLauncher />);
      click(en.launcher.open);
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
    click(en.launcher.open);
    click(nameOf('dino'));
    advance(1000);

    click(en.launcher.backToGames);
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(vi.getTimerCount()).toBe(0);
  });
});
