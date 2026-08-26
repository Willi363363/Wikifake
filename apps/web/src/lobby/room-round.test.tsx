/** @vitest-environment jsdom */

// The round, as the room drives it.
//
// Split from `room.test.tsx` when it crossed the 500-line cap: the lobby's own
// suite is there, and these two are about what happens after `game_start`. The
// harness both files use is `testing.tsx`.
//
// What the round *is* — the article, the gesture, the clock, the negative
// assertion, the intel panel — is `src/round/`. What is asserted here is the
// transport: what leaves over the socket, and what the screen makes of what
// arrives.
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
  ROUND_ENDS,
  sent,
} from './testing.js';
import { installFakeSocket } from '../realtime/testing.js';

let uninstall: () => void;

beforeEach(() => {
  uninstall = installFakeSocket();
  globalThis.sessionStorage.clear();
});
afterEach(() => {
  cleanup();
  uninstall();
});

// Step 8.1 — the round the room renders is the round solo renders. What the room
// owns is the transport: the answer leaves over the socket, and "you have
// submitted" is the server's `answered` rather than a flag this screen sets.
describe('8.1 — the round, in a room', () => {
  /** Into the round: the generation screen has to be seen to fill first. */
  /** Into the round: the generation screen has to be seen to fill first. */
  function intoTheRound(): void {
    deliver({
      type: 'theme_selected',
      topic: 'Chat',
      proposer: 'ada',
      ballots: { ada: 'Chat' },
    });
    deliver(ROUND_BEGINS);
    act(() => {
      vi.advanceTimersByTime(SETTLE_MS);
    });
  }

  const tokens = () =>
    screen.getAllByRole('button', { name: new RegExp(`^(${PARAGRAPHS.join('|')})`) });

  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows the article the server started, not the lobby', () => {
    mountRoom();
    deliver(roster(player('ada', { isHost: true })));
    intoTheRound();

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Chat');
    expect(tokens()).toHaveLength(3);
    expect(screen.queryByText(/^Players/)).toBeNull();
  });

  it('counts down from the limit the server sent, not the host settings', () => {
    mountRoom();
    deliver(roster(player('ada', { isHost: true })));
    intoTheRound();

    // 120 seconds, where the host-settings default in this browser is 300.
    expect(screen.getByRole('timer').textContent).toContain('02:00');
  });

  it('sends the marked paragraphs as 1-based numbers', () => {
    mountRoom();
    deliver(roster(player('ada', { isHost: true })));
    intoTheRound();

    fireEvent.click(tokens()[0] as HTMLElement);
    fireEvent.click(tokens()[2] as HTMLElement);
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

    expect(sent().at(-1)).toEqual({ type: 'submit_answer', marked: [1, 3] });
  });

  // The rule this screen follows everywhere: what the server says, not what the
  // player just did. A submission the server refused — out of phase, on a socket
  // that was already down — must not read as submitted.
  it('reads "submitted" off the roster, not off the click', () => {
    mountRoom();
    deliver(roster(player('ada', { isHost: true })));
    intoTheRound();

    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));
    // Nothing has come back yet, so nothing has changed.
    expect(screen.getByRole('button', { name: 'Submit' })).not.toBeNull();

    deliver(roster(player('ada', { isHost: true, answered: true })));
    expect(screen.getByRole('button', { name: 'Take it back' })).not.toBeNull();
  });

  it('takes a submission back over the socket', () => {
    mountRoom();
    deliver(roster(player('ada', { isHost: true, answered: true })));
    intoTheRound();

    fireEvent.click(screen.getByRole('button', { name: 'Take it back' }));
    expect(sent().at(-1)).toEqual({ type: 'unsubmit_answer' });
  });

  it('returns to the lobby when the round ends', () => {
    mountRoom();
    deliver(roster(player('ada', { isHost: true })));
    intoTheRound();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Chat');

    // `ROUND_ENDS` carries a solution because `solution` is `.min(1)`: an empty
    // one does not decode, and the message would be dropped in silence — a green
    // test that never ended a round.
    deliver(ROUND_ENDS);

    expect(screen.getByText('Players (1)')).not.toBeNull();
    // The debrief is step 8.7. Until it exists the article goes with the round
    // rather than lingering under a lobby.
    expect(screen.queryByRole('heading', { level: 1, name: 'Chat' })).toBeNull();
  });
});

// Step 8.2 — the hints of a room, over the socket. The state and its one rule
// are `round/hints.ts`, shared with solo; what is asserted here is the transport.
describe('8.2 — hints, in a room', () => {
  function intoTheRound(): void {
    deliver(ROUND_BEGINS);
    act(() => {
      vi.advanceTimersByTime(SETTLE_MS);
    });
  }

  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const openIntel = (): void => {
    fireEvent.click(screen.getByRole('button', { name: /^Intel/ }));
  };

  it('asks the server for a level, and charges nothing itself', () => {
    mountRoom();
    deliver(roster(player('ada', { isHost: true })));
    intoTheRound();
    openIntel();

    fireEvent.click(screen.getByRole('button', { name: 'Reveal target 2' }));
    expect(sent().at(-1)).toEqual({ type: 'unlock_hint', falseInfoNumber: 2, level: 2 });
  });

  it('shows what the server granted, and the penalty the server states', () => {
    mountRoom();
    deliver(roster(player('ada', { isHost: true })));
    intoTheRound();

    deliver({
      type: 'hint_unlocked',
      falseInfoNumber: 1,
      hint: 'Regardez la durée.',
      charged: 50,
      hintPenalty: 50,
      grant: { level: 1 },
    });
    openIntel();

    expect(screen.getByRole('dialog').textContent).toContain('Regardez la durée.');
    // C1.3 — the number the server states, not one this client added up.
    expect(screen.getByRole('dialog').textContent).toContain('spent 50');
  });

  it('points at the paragraph a reveal named', () => {
    mountRoom();
    deliver(roster(player('ada', { isHost: true })));
    intoTheRound();

    deliver({
      type: 'hint_unlocked',
      falseInfoNumber: 1,
      hint: 'Regardez la durée.',
      charged: 200,
      hintPenalty: 200,
      grant: { level: 2, truth: 'Il en dort douze.', paragraphIndex: 2 },
    });

    const marks = screen
      .getAllByRole('button', { name: new RegExp(`^(${PARAGRAPHS.join('|')})`) })
      .map((token) => token.getAttribute('data-state'));
    expect(marks).toEqual(['idle', 'hinted', 'idle']);
  });

  // C1.5 — and the second half of the step's done-when: it displays, and nothing
  // crashes.
  it('shows a jam without taking the round down', () => {
    mountRoom();
    deliver(roster(player('ada', { isHost: true })));
    intoTheRound();

    deliver({
      type: 'error',
      code: 'hints_blocked',
      message: 'un joueur a brouillé vos indices',
    });

    // Still a round, and no panel forced over it: the article is on screen and
    // the clock is running.
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Chat');
    expect(screen.getByRole('timer')).not.toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Intel — jammed' }));
    expect(screen.getByRole('dialog').textContent).toContain('jammed your intel');
  });

  // Same rule as for the items: the intel panel owns `hints_blocked`, so the
  // room does not also show it as a refusal under the article.
  it('says a jam once, not twice', () => {
    mountRoom();
    deliver(roster(player('ada', { isHost: true })));
    intoTheRound();

    deliver({
      type: 'error',
      code: 'hints_blocked',
      message: 'un joueur a brouillé vos indices',
    });
    expect(screen.queryByRole('alert')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Intel — jammed' }));
    expect(screen.getAllByRole('alert')).toHaveLength(1);
  });

  it('leaves the hints of the last round behind when a new one starts', () => {
    mountRoom();
    deliver(roster(player('ada', { isHost: true })));
    intoTheRound();
    deliver({
      type: 'hint_unlocked',
      falseInfoNumber: 1,
      hint: 'Regardez la durée.',
      charged: 50,
      hintPenalty: 50,
      grant: { level: 1 },
    });
    expect(screen.getByRole('button', { name: /^Intel/ }).textContent).toContain('1');

    // A second round with the same number of falsifications, which is the case
    // the current hook gets wrong: keyed on `totalFakes`, the ledger survives.
    deliver(ROUND_ENDS);
    deliver({ ...ROUND_BEGINS, topic: 'Chien' });
    act(() => {
      vi.advanceTimersByTime(SETTLE_MS);
    });

    expect(screen.getByRole('button', { name: 'Intel' })).not.toBeNull();
    openIntel();
    expect(screen.getByRole('dialog').textContent).not.toContain('Regardez la durée.');
  });
});
