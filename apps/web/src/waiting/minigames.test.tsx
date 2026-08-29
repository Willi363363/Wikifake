/** @vitest-environment jsdom */

// Each game, played through the DOM.
//
// The rules are asserted without a DOM in `rules.test.ts`, and the launcher's
// contract — six games that launch, replay and leave no timer behind — in
// `launcher.test.tsx`. What is left is the wiring between the two: that a click
// reaches the rule, and that what the rule decided reaches the screen.
import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DinoRun } from './dino-run.js';
import { MemoryCards } from './memory-cards.js';
import { PatternMatch } from './pattern-match.js';
import { ReactionSpeed } from './reaction-speed.js';
import { Snake } from './snake.js';
import { TicTacToe } from './tic-tac-toe.js';
import { render } from '../i18n/testing.js';
import en from '../../messages/en/waiting.json';

/** The one replay label all six games share, read where they read it. */
const PLAY_AGAIN = en.controls.playAgain;

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

const button = (name: string | RegExp): HTMLElement =>
  screen.getByRole('button', { name });

/** `noUncheckedIndexedAccess`, honestly: a missing element is a failing test. */
const nth = (elements: readonly HTMLElement[], at: number): HTMLElement => {
  const found = elements[at];
  if (found === undefined) throw new Error(`nothing at index ${String(at)}`);
  return found;
};

describe('7.6 — snake', () => {
  it('starts one cell long, and says so', () => {
    render(<Snake />);
    expect(screen.getByRole('img', { name: 'Snake, 1 long' })).not.toBeNull();
  });

  it('ends against the wall, and starts over on request', () => {
    render(<Snake />);
    // Heading east from the tenth column: fourteen ticks to the far wall.
    advance(3000);
    expect(screen.getByText('Game over')).not.toBeNull();

    fireEvent.click(button(PLAY_AGAIN));
    expect(screen.queryByText('Game over')).toBeNull();
    expect(screen.getByRole('img', { name: 'Snake, 1 long' })).not.toBeNull();
  });
});

describe('7.6 — agent dash', () => {
  it('ends on an obstacle taken at ground level', () => {
    render(<DinoRun />);
    // The obstacle enters at 320 and closes at four pixels a frame.
    advance(2000);
    expect(screen.getByText('Game over')).not.toBeNull();
  });

  it('offers the jump to a pointer as well as to a keyboard', () => {
    render(<DinoRun />);
    expect(button('Jump')).not.toBeNull();
  });

  it('starts over on request', () => {
    render(<DinoRun />);
    advance(2000);
    fireEvent.click(button(PLAY_AGAIN));
    expect(screen.queryByText('Game over')).toBeNull();
    expect(screen.getByText('Score 0')).not.toBeNull();
  });
});

describe('7.6 — tic-tac-toe', () => {
  it('marks the square you played', () => {
    render(<TicTacToe />);
    fireEvent.click(button('Square 1'));
    expect(button('Square 1, X')).not.toBeNull();
  });

  it('lets the opponent answer, after a pause', () => {
    render(<TicTacToe />);
    fireEvent.click(button('Square 1'));
    expect(screen.getByText('Thinking…')).not.toBeNull();

    advance(1000);
    // Nothing to win and nothing to block, so it takes the centre — which is
    // the rule, and is why this assertion can be exact.
    expect(button('Square 5, O')).not.toBeNull();
    expect(screen.getByText('Your turn')).not.toBeNull();
  });

  it('refuses a square that is taken', () => {
    render(<TicTacToe />);
    fireEvent.click(button('Square 1'));
    advance(1000);

    const played = button('Square 1, X');
    expect(played.hasAttribute('disabled')).toBe(true);
  });
});

describe('7.6 — memory cards', () => {
  const cards = (): readonly HTMLElement[] =>
    screen.getAllByRole('button', { name: /^Card / });

  it('deals eight cards, all face down', () => {
    render(<MemoryCards />);
    expect(cards()).toHaveLength(8);
    expect(screen.getAllByRole('button', { name: /face down$/ })).toHaveLength(8);
    expect(screen.getByText('0 of 4 pairs')).not.toBeNull();
  });

  it('keeps a pair that matches', () => {
    render(<MemoryCards />);
    // The glyphs are in the document behind a card that does not show them — a
    // memory game in a waiting room is not a secret, and it is what lets this
    // test know which two cards are a pair.
    const glyphs = cards().map((card) => card.textContent ?? '');
    let first = -1;
    let second = -1;
    for (let a = 0; a < glyphs.length && second === -1; a += 1) {
      for (let b = a + 1; b < glyphs.length; b += 1) {
        if (glyphs[a] === glyphs[b]) {
          first = a;
          second = b;
          break;
        }
      }
    }
    expect(second).toBeGreaterThan(-1);

    fireEvent.click(nth(cards(), first));
    fireEvent.click(nth(cards(), second));
    advance(600);

    expect(screen.getByText('1 of 4 pairs')).not.toBeNull();
    // Since 11.2 the count is an ICU plural, so one move reads "1 move".
    expect(screen.getByText('1 move')).not.toBeNull();
  });

  it('turns a mismatched pair back over', () => {
    render(<MemoryCards />);
    const glyphs = cards().map((card) => card.textContent ?? '');
    const other = glyphs.findIndex((glyph) => glyph !== glyphs[0]);

    fireEvent.click(nth(cards(), 0));
    fireEvent.click(nth(cards(), other));
    advance(1000);

    expect(screen.getAllByRole('button', { name: /face down$/ })).toHaveLength(8);
    expect(screen.getByText('0 of 4 pairs')).not.toBeNull();
  });

  it('re-deals on request', () => {
    render(<MemoryCards />);
    fireEvent.click(nth(cards(), 0));
    fireEvent.click(button(PLAY_AGAIN));
    expect(screen.getAllByRole('button', { name: /face down$/ })).toHaveLength(8);
  });
});

describe('7.6 — pattern match', () => {
  it('shows a pattern before it asks for it', () => {
    render(<PatternMatch />);
    expect(screen.getByText('Memorise the pattern…')).not.toBeNull();
    // Nothing is clickable while the pattern is on screen.
    for (const square of screen.getAllByRole('button', { name: /^Square / })) {
      expect(square.hasAttribute('disabled')).toBe(true);
    }

    advance(2500);
    expect(screen.getByText('Pick 3 squares')).not.toBeNull();
  });

  it('takes a pick, and shows it as taken', () => {
    render(<PatternMatch />);
    advance(2500);

    const square = button('Square 1');
    fireEvent.click(square);
    expect(square.getAttribute('aria-pressed')).toBe('true');
  });

  it('grades a full guess, and moves on', () => {
    render(<PatternMatch />);
    advance(2500);
    // Three squares, whatever they are: the guess is complete, so it is graded.
    for (const at of [1, 2, 3]) fireEvent.click(button(`Square ${String(at)}`));

    const verdict = screen.getByText(/^(Perfect|Not quite)$/);
    expect(verdict).not.toBeNull();

    advance(2000);
    expect(screen.getByText(/round 2$/)).not.toBeNull();
  });

  it('starts a new pattern on request', () => {
    render(<PatternMatch />);
    advance(2500);
    fireEvent.click(button(PLAY_AGAIN));
    expect(screen.getByText('Memorise the pattern…')).not.toBeNull();
  });
});

describe('7.6 — reaction speed', () => {
  it('makes you wait for the target', () => {
    render(<ReactionSpeed />);
    expect(screen.getByText('Wait for the target…')).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'Hit the target' })).toBeNull();

    // The wait is at most 3.5 seconds, so by then the target is out.
    advance(3500);
    expect(button('Hit the target')).not.toBeNull();
  });

  it('measures the time it took, and remembers the best', () => {
    render(<ReactionSpeed />);
    advance(3500);
    advance(120);
    fireEvent.click(button('Hit the target'));

    expect(screen.getByText(/^\d+ ms$/)).not.toBeNull();
    expect(screen.getByText(/^best \d+ ms$/)).not.toBeNull();
  });

  it('calls out a click before the target, and does not score it', () => {
    render(<ReactionSpeed />);
    fireEvent.click(button('The playing field'));

    expect(screen.getByText('Too early')).not.toBeNull();
    expect(screen.queryByText(/^best/)).toBeNull();
  });

  it('starts another round after a false start', () => {
    render(<ReactionSpeed />);
    fireEvent.click(button('The playing field'));
    advance(1500);
    expect(screen.getByText('Wait for the target…')).not.toBeNull();
  });
});
