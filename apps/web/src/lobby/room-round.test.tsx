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
import { PER_TRUE_POSITIVE } from '@wikifake/domain';
import { LIVE_SCORE_MIN_INTERVAL_MS } from '@wikifake/protocol';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SETTLE_MS } from './generation.js';
import {
  deliver,
  mountRoom,
  PARAGRAPHS,
  player,
  roster,
  startRound,
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
    startRound();

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Chat');
    expect(tokens()).toHaveLength(3);
    expect(screen.queryByText(/^Players/)).toBeNull();
  });

  it('counts down from the limit the server sent, not the host settings', () => {
    mountRoom();
    deliver(roster(player('ada', { isHost: true })));
    startRound();

    // 120 seconds, where the host-settings default in this browser is 300.
    expect(screen.getByRole('timer').textContent).toContain('02:00');
  });

  it('sends the marked paragraphs as 1-based numbers', () => {
    mountRoom();
    deliver(roster(player('ada', { isHost: true })));
    startRound();

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
    startRound();

    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));
    // Nothing has come back yet, so nothing has changed.
    expect(screen.getByRole('button', { name: 'Submit' })).not.toBeNull();

    deliver(roster(player('ada', { isHost: true, answered: true })));
    expect(screen.getByRole('button', { name: 'Take it back' })).not.toBeNull();
  });

  it('takes a submission back over the socket', () => {
    mountRoom();
    deliver(roster(player('ada', { isHost: true, answered: true })));
    startRound();

    fireEvent.click(screen.getByRole('button', { name: 'Take it back' }));
    expect(sent().at(-1)).toEqual({ type: 'unsubmit_answer' });
  });

  it('shows the debrief when the round ends, and keeps the article', () => {
    mountRoom();
    deliver(roster(player('ada', { isHost: true })));
    startRound();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Chat');

    // `ROUND_ENDS` carries a solution because `solution` is `.min(1)`: an empty
    // one does not decode, and the message would be dropped in silence — a green
    // test that never ended a round.
    deliver(ROUND_ENDS);

    // Step 8.7 — the debrief, above the article rather than over it, so C6.1's
    // attribution is still on screen after the round.
    expect(screen.getByRole('region', { name: 'Debrief' })).not.toBeNull();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Chat');
    expect(screen.queryByText('Players (1)')).toBeNull();
  });

  it('goes back to the lobby when the player says so, not when the message lands', () => {
    mountRoom();
    deliver(roster(player('ada', { isHost: true })));
    startRound();
    deliver(ROUND_ENDS);

    // The ranking has to finish before the way onward is offered.
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    fireEvent.click(screen.getByRole('button', { name: 'Back to the room' }));

    expect(screen.getByText('Players (1)')).not.toBeNull();
    expect(screen.queryByRole('region', { name: 'Debrief' })).toBeNull();
  });
});

// Step 8.2 — the hints of a room, over the socket. The state and its one rule
// are `round/hints.ts`, shared with solo; what is asserted here is the transport.
describe('8.2 — hints, in a room', () => {
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
    startRound();
    openIntel();

    fireEvent.click(screen.getByRole('button', { name: 'Reveal target 2' }));
    expect(sent().at(-1)).toEqual({ type: 'unlock_hint', falseInfoNumber: 2, level: 2 });
  });

  it('shows what the server granted, and the penalty the server states', () => {
    mountRoom();
    deliver(roster(player('ada', { isHost: true })));
    startRound();

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
    startRound();

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
    startRound();

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
    startRound();

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
    startRound();
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

// Step 8.5 — C5.5, over the socket: what this browser sends, and whose pointers
// it draws.
describe('8.5 — cursors, in a room', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const cursor = (name: string) =>
    document.querySelector<HTMLElement>(`[data-cursor="${name}"]`);

  /** A mouse at a place on an 800 by 600 viewport. */
  function pointAt(x: number, y: number): void {
    vi.spyOn(globalThis, 'innerWidth', 'get').mockReturnValue(800);
    vi.spyOn(globalThis, 'innerHeight', 'get').mockReturnValue(600);
    act(() => {
      globalThis.dispatchEvent(new MouseEvent('mousemove', { clientX: x, clientY: y }));
    });
  }

  it('sends a fraction of the viewport, not a pixel', () => {
    mountRoom();
    deliver(roster(player('ada', { isHost: true }), player('bob')));
    startRound();

    pointAt(400, 300);
    expect(sent().at(-1)).toEqual({ type: 'cursor', x: 0.5, y: 0.5 });
  });

  it('paces what it sends', () => {
    mountRoom();
    deliver(roster(player('ada', { isHost: true }), player('bob')));
    startRound();

    pointAt(400, 300);
    const after = sent().length;
    pointAt(410, 310);
    // C5.5 — the server throttles too, and that is the one that counts. This is
    // so a room does not have to be slowed down to stay quiet.
    expect(sent().length).toBe(after);

    act(() => {
      vi.advanceTimersByTime(100);
    });
    pointAt(420, 320);
    expect(sent().length).toBeGreaterThan(after);
  });

  it('sends nothing outside a round', () => {
    mountRoom();
    deliver(roster(player('ada', { isHost: true }), player('bob')));

    const before = sent().length;
    pointAt(400, 300);
    // A lobby does not need sixteen frames a second of anybody's mouse.
    expect(sent().length).toBe(before);
  });

  it('draws another player where they pointed, in their colour', () => {
    mountRoom();
    deliver(roster(player('ada', { isHost: true }), player('bob')));
    startRound();

    deliver({ type: 'cursor_update', player: 'bob', x: 0.25, y: 0.75 });
    expect(cursor('bob')?.style.left).toBe('25%');
    expect(cursor('bob')?.style.top).toBe('75%');
  });

  // The done-when: a player who leaves sees their cursor disappear for the
  // others.
  it('takes a cursor away when its owner leaves', () => {
    mountRoom();
    deliver(roster(player('ada', { isHost: true }), player('bob')));
    startRound();
    deliver({ type: 'cursor_update', player: 'bob', x: 0.25, y: 0.75 });
    expect(cursor('bob')).not.toBeNull();

    deliver(roster(player('ada', { isHost: true })));
    expect(cursor('bob')).toBeNull();
  });

  it('takes it away when their socket drops, too', () => {
    // D5 keeps the seat for thirty seconds. A pointer that has stopped moving
    // because its owner is gone is a pointer that says they are still there.
    mountRoom();
    deliver(roster(player('ada', { isHost: true }), player('bob')));
    startRound();
    deliver({ type: 'cursor_update', player: 'bob', x: 0.25, y: 0.75 });

    deliver(roster(player('ada', { isHost: true }), player('bob', { connected: false })));
    expect(cursor('bob')).toBeNull();
  });
});

// Step 8.6 — D6, over the socket: what this browser publishes, how often, and
// what it makes of what comes back.
describe('8.6 — the live ranking, in a room', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const scores = () => sent().filter((each) => each.type === 'live_score');
  const openRanking = (): void => {
    fireEvent.click(screen.getByRole('button', { expanded: false }));
  };

  function inARoundOfTwo(): void {
    deliver(roster(player('ada', { isHost: true }), player('bob')));
    startRound();
  }

  it('publishes the optimistic tally when a paragraph is marked', () => {
    mountRoom();
    inARoundOfTwo();
    const before = scores().length;

    fireEvent.click(
      screen.getAllByRole('button', {
        name: new RegExp(`^(${PARAGRAPHS.join('|')})`),
      })[0] as HTMLElement,
    );
    act(() => {
      vi.advanceTimersByTime(LIVE_SCORE_MIN_INTERVAL_MS + 50);
    });

    // Every mark counted as correct: an opponent's live score must not be
    // readable as the answer key.
    expect(scores().at(-1)).toEqual({ type: 'live_score', score: PER_TRUE_POSITIVE });
    expect(scores().length).toBeGreaterThan(before);
  });

  // The second half of the done-when: throttled client-side as well as
  // server-side, at the same number, imported from the contract.
  it('sends one message per window however fast the ticking is', () => {
    mountRoom();
    inARoundOfTwo();
    const before = scores().length;

    const tokens = screen.getAllByRole('button', {
      name: new RegExp(`^(${PARAGRAPHS.join('|')})`),
    });
    for (const token of tokens) fireEvent.click(token);

    act(() => {
      vi.advanceTimersByTime(LIVE_SCORE_MIN_INTERVAL_MS + 50);
    });

    // Three marks inside one window, one message — and it carries the *last*
    // value, because a score that stops one tick short of the truth is simply
    // wrong for the rest of the round.
    expect(scores().length - before).toBe(1);
    expect(scores().at(-1)).toEqual({
      type: 'live_score',
      score: 3 * PER_TRUE_POSITIVE,
    });
  });

  it('shows the ranking the server reported, leader first', () => {
    mountRoom();
    inARoundOfTwo();

    deliver({ type: 'live_score_update', player: 'bob', score: 450 });
    expect(screen.getByText('bob')).not.toBeNull();

    openRanking();
    const rows = screen.getAllByRole('listitem').map((each) => each.textContent);
    expect(rows[0]).toContain('bob');
    expect(rows[1]).toContain('ada');
  });

  it('starts everyone back at nothing for a new round', () => {
    mountRoom();
    inARoundOfTwo();
    deliver({ type: 'live_score_update', player: 'bob', score: 450 });

    deliver({ ...ROUND_BEGINS, topic: 'Chien' });
    act(() => {
      vi.advanceTimersByTime(SETTLE_MS);
    });
    openRanking();

    expect(screen.getAllByRole('listitem')[0]?.textContent).not.toContain('450');
  });
});
