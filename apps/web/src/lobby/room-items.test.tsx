/** @vitest-environment jsdom */

// D6 — the item chain over the socket.
//
// The half that never existed: nothing in the current game sends `use_item`,
// because the handler its bar was wired to was not defined. What is asserted here
// is the transport — what leaves, what arrives, and which of the four inbound
// messages means what.
//
// Every round below starts with `withItems: true`. The current smoke test renders
// with items off, which is how a `ReferenceError` on the main multiplayer path
// survived to production.
import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SETTLE_MS } from './generation.js';
import {
  deliver,
  mountRoom,
  PARAGRAPHS,
  player,
  roster,
  ROUND_BEGINS,
  sent,
  wave,
} from './testing.js';
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

/** A round in progress, with two rivals and items on. */
function intoTheRound(): void {
  deliver(roster(player('ada', { isHost: true }), player('bob'), player('cleo')));
  deliver(ROUND_BEGINS);
  act(() => {
    vi.advanceTimersByTime(SETTLE_MS);
  });
}

const bar = () => screen.queryByRole('toolbar', { name: 'Your items' });

describe('8.3 — the hand a room deals', () => {
  it('shows nothing before a wave arrives', () => {
    mountRoom();
    intoTheRound();
    expect(bar()).toBeNull();
  });

  it('takes this player’s item out of the wave, and nobody else’s', () => {
    mountRoom();
    intoTheRound();
    deliver(
      wave({
        ada: { instanceId: 'a1', itemId: 'SPIN' },
        bob: { instanceId: 'b1', itemId: 'SCORE_STEAL' },
      }),
    );

    expect(screen.getByRole('button', { name: /^Vertigo —/ })).not.toBeNull();
    // A wave carries everybody's. Showing the lot would offer a hand that
    // cannot be spent.
    expect(screen.queryByRole('button', { name: /^Pickpocket —/ })).toBeNull();
  });

  it('shows nothing when the wave has nothing for this player', () => {
    mountRoom();
    intoTheRound();
    deliver(wave({ bob: { instanceId: 'b1', itemId: 'SPIN' } }));
    expect(bar()).toBeNull();
  });
});

describe('8.3 — throwing one', () => {
  function withASpin(): void {
    mountRoom();
    intoTheRound();
    deliver(wave({ ada: { instanceId: 'a1', itemId: 'SPIN' } }));
  }

  it('sends the instance, the target, and what is marked', () => {
    withASpin();
    fireEvent.click(
      screen.getAllByRole('button', {
        name: new RegExp(`^(${PARAGRAPHS.join('|')})`),
      })[0] as HTMLElement,
    );

    fireEvent.click(screen.getByRole('button', { name: /^Vertigo —/ }));
    fireEvent.click(screen.getByRole('radio', { name: 'bob' }));
    fireEvent.click(screen.getByRole('button', { name: 'Throw it at bob' }));

    // The instance, not the kind: a player can hold two, and spending one must
    // not spend both. C1.6 — `marked` rides along so the detector does not point
    // at a paragraph already ticked.
    expect(sent().at(-1)).toEqual({
      type: 'use_item',
      instanceId: 'a1',
      targets: ['bob'],
      marked: [1],
    });
  });

  it('offers every other player, and never this one', () => {
    withASpin();
    fireEvent.click(screen.getByRole('button', { name: /^Vertigo —/ }));

    expect(screen.getAllByRole('radio').map((each) => each.textContent)).toEqual([
      'bob',
      'cleo',
    ]);
  });

  it('takes the item out of the hand when the server says it was spent', () => {
    withASpin();
    fireEvent.click(screen.getByRole('button', { name: /^Vertigo —/ }));
    fireEvent.click(screen.getByRole('radio', { name: 'bob' }));
    fireEvent.click(screen.getByRole('button', { name: 'Throw it at bob' }));
    // Still in hand, in flight: the server has not answered.
    expect(screen.getByRole('button', { name: /^Vertigo —/ })).not.toBeNull();

    deliver({ type: 'item_used', player: 'ada', itemId: 'SPIN', targets: ['bob'] });
    expect(bar()).toBeNull();
  });

  it('leaves the hand alone when somebody else spends something', () => {
    withASpin();
    deliver({ type: 'item_used', player: 'bob', itemId: 'SPIN', targets: ['ada'] });

    // Somebody else spending a Vertigo is news, not bookkeeping.
    expect(screen.getByRole('button', { name: /^Vertigo —/ })).not.toBeNull();
  });

  it('keeps the item when the server refuses the targets', () => {
    withASpin();
    fireEvent.click(screen.getByRole('button', { name: /^Vertigo —/ }));
    fireEvent.click(screen.getByRole('radio', { name: 'bob' }));
    fireEvent.click(screen.getByRole('button', { name: 'Throw it at bob' }));

    deliver({
      type: 'error',
      code: 'invalid_target',
      message: 'those targets make no sense',
    });

    // Refused before it was spent, so it is still theirs.
    expect(screen.getByRole('alert').textContent).toContain('make no sense');
    expect(
      screen.getByRole('button', { name: /^Vertigo —/ }).hasAttribute('disabled'),
    ).toBe(false);
  });

  // Two hooks watch `error`, and only one of them owns these codes. Shown by
  // both, the same refusal appears twice on the same screen in two places.
  it('says an item refusal once, not twice', () => {
    withASpin();
    fireEvent.click(screen.getByRole('button', { name: /^Vertigo —/ }));
    fireEvent.click(screen.getByRole('radio', { name: 'bob' }));
    fireEvent.click(screen.getByRole('button', { name: 'Throw it at bob' }));

    deliver({
      type: 'error',
      code: 'invalid_target',
      message: 'those targets make no sense',
    });
    expect(screen.getAllByRole('alert')).toHaveLength(1);
  });

  it('drops the item when the server says it was never held', () => {
    withASpin();
    fireEvent.click(screen.getByRole('button', { name: /^Vertigo —/ }));
    fireEvent.click(screen.getByRole('radio', { name: 'bob' }));
    fireEvent.click(screen.getByRole('button', { name: 'Throw it at bob' }));

    deliver({
      type: 'error',
      code: 'item_not_held',
      message: 'you do not hold that item',
    });

    // The hand this client was showing is stale. Keeping the card invites a
    // second refusal.
    expect(bar()).toBeNull();
  });
});

describe('8.3 — what lands on you', () => {
  it('says who threw it', () => {
    mountRoom();
    intoTheRound();
    deliver({ type: 'item_effect', itemId: 'BLUR', from: 'bob' });

    expect(screen.getByText(/hit you with/).textContent).toContain('bob');
  });

  // C1.6 — resolved by the server, because the client does not know the solution.
  it('points at the paragraph the detector found', () => {
    mountRoom();
    intoTheRound();
    deliver(wave({ ada: { instanceId: 'a1', itemId: 'SCANNER' } }));

    fireEvent.click(screen.getByRole('button', { name: /^Detector —/ }));
    expect(sent().at(-1)).toEqual({
      type: 'use_item',
      instanceId: 'a1',
      targets: [],
      marked: [],
    });

    deliver({ type: 'scanner_result', paragraphIndex: 3 });
    const marks = screen
      .getAllByRole('button', { name: new RegExp(`^(${PARAGRAPHS.join('|')})`) })
      .map((token) => token.getAttribute('data-state'));
    expect(marks).toEqual(['idle', 'idle', 'scanned']);
  });

  it('says when the detector has nothing left', () => {
    mountRoom();
    intoTheRound();
    deliver({ type: 'scanner_result', paragraphIndex: null });

    expect(screen.getByText(/nothing left to point at/)).not.toBeNull();
  });

  it('leaves the hand of the last round behind when a new one starts', () => {
    mountRoom();
    intoTheRound();
    deliver(wave({ ada: { instanceId: 'a1', itemId: 'SPIN' } }));
    expect(bar()).not.toBeNull();

    deliver({ ...ROUND_BEGINS, topic: 'Chien' });
    act(() => {
      vi.advanceTimersByTime(SETTLE_MS);
    });
    expect(bar()).toBeNull();
  });
});
