/** @vitest-environment jsdom */

// What a player meets when the retry loop has spent its window — step P.2.
//
// Driven through the real provider rather than by handing the card a prop: the
// state under test is *reached*, five drops and thirty seconds of fake clock at
// a time, because "the card renders when you pass it `lost`" would have passed
// just as well while nothing could ever produce a `lost`.
import { act, cleanup, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { deliver, live, mountRoom, player, roster, startRound } from './testing.js';
import { installFakeSocket } from '../realtime/testing.js';

let uninstall: () => void;

beforeEach(() => {
  uninstall = installFakeSocket();
  globalThis.sessionStorage.clear();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
  uninstall();
});

/** Q.1's ladder: 1s, 2s, 4s, 8s, then a quarter of a minute, for ever. */
const DELAYS = [1000, 2000, 4000, 8000, ...Array<number>(7).fill(15_000)];

/**
 * Drops the socket until the room has been unreachable for two minutes.
 *
 * Two minutes rather than P.1's thirty seconds, and that is the step: this
 * host sleeps and wakes in about a minute, so a card shown at thirty seconds
 * was shown to players whose service was already on its way back.
 */
function loseTheConnection(): void {
  for (const delay of DELAYS) {
    act(() => {
      live().drop(1006);
    });
    act(() => {
      vi.advanceTimersByTime(delay);
    });
  }
  // The drop that lands past the threshold. The loop goes on; the card appears.
  act(() => {
    live().drop(1006);
  });
}

describe('P.2 — the connection that is not coming back', () => {
  it('replaces the room rather than putting a badge over a frozen one', () => {
    mountRoom();
    deliver(roster(player('ada', { isHost: true }), player('bob')));
    expect(screen.getByText('Players (2)')).not.toBeNull();

    loseTheConnection();

    expect(screen.getByText('Connection lost')).not.toBeNull();
    // The roster is gone, not greyed out: every name on it was as old as the
    // drop, and a list nobody is updating is the lie this step removes.
    expect(screen.queryByText('Players (2)')).toBeNull();
    expect(screen.queryByText('bob')).toBeNull();
  });

  it('keeps the code in front of the player', () => {
    mountRoom();
    loseTheConnection();

    // **On the card**, and not left over from the room's own header. Asserting
    // the code is on screen anywhere passes while the card is missing
    // entirely, which is a test that agrees with the defect.
    const card = screen.getByText('Connection lost').closest('main');
    expect(card).not.toBeNull();
    expect(within(card as HTMLElement).getByText('A1B2C3')).not.toBeNull();
  });

  it('takes the round too, where a stale screen is most convincing', () => {
    mountRoom();
    startRound();
    expect(screen.queryByText('Connection lost')).toBeNull();

    loseTheConnection();

    expect(screen.getByText('Connection lost')).not.toBeNull();
  });

  it('opens a socket again when the player asks, and gives the room back', () => {
    mountRoom();
    const before = live();
    loseTheConnection();

    fireEvent.click(screen.getByRole('button', { name: 'Try now' }));
    expect(live()).not.toBe(before);

    act(() => {
      live().accept();
    });
    deliver(roster(player('ada')));

    expect(screen.queryByText('Connection lost')).toBeNull();
    expect(screen.getByText('Players (1)')).not.toBeNull();
  });

  it('offers a way out that is not another attempt', () => {
    mountRoom();
    loseTheConnection();

    // A service that is down wants the home page, not a sixth try. Neither is
    // the obvious answer from inside the room, so both are offered.
    const home = screen.getByRole('link', { name: 'Back to the home page' });
    expect(home.getAttribute('href')).toBe('/');
  });
});
