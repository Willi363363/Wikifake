'use client';

// Tic-tac-toe against a small opponent.
//
// The opponent is the current one, rule for rule: take the win, else block the
// loss, else the centre, else anywhere. It is beatable, which for a game played
// while an article loads is the point.
import { cn } from '@wikifake/ui';
import { useEffect, useState } from 'react';

import { PlayAgain } from './controls.js';
import { useTimers } from '../timers.js';

export type Mark = 'X' | 'O';
export type Square = Mark | null;
export type Board = readonly Square[];

/** How long the opponent appears to think, so its move is seen to happen. */
const THINKS_MS = 400;
const THINKS_JITTER_MS = 300;

/** How long a finished board stays up before it clears itself. */
const RESULT_MS = 1800;

export const EMPTY: Board = [null, null, null, null, null, null, null, null, null];

export const LINES: readonly (readonly [number, number, number])[] = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

export interface Outcome {
  /** The winner, or a draw. */
  readonly mark: Mark | 'draw';
  /** The three squares that won it, or null for a draw. */
  readonly line: readonly number[] | null;
}

/** The outcome, or null while the game is still open. */
export function winnerOf(board: Board): Outcome | null {
  for (const line of LINES) {
    const [a, b, c] = line;
    const mark = board[a];
    if (mark !== null && mark !== undefined && mark === board[b] && mark === board[c]) {
      return { mark, line };
    }
  }
  return board.every((square) => square !== null) ? { mark: 'draw', line: null } : null;
}

/** Where `mark` would complete a line, or -1 if nowhere. */
function completes(board: Board, mark: Mark): number {
  for (const line of LINES) {
    const squares = line.map((at) => board[at]);
    const mine = squares.filter((square) => square === mark).length;
    const blanks = squares.filter((square) => square === null).length;
    if (mine === 2 && blanks === 1) return line[squares.indexOf(null)] ?? -1;
  }
  return -1;
}

/**
 * The opponent's move: win, block, centre, anywhere.
 *
 * `pick` chooses among the free squares, so a test decides the "anywhere" and
 * the component keeps it random.
 */
export function replyTo(board: Board, pick: (count: number) => number): number {
  const free = board.flatMap((square, at) => (square === null ? [at] : []));
  if (free.length === 0) return -1;

  const win = completes(board, 'O');
  if (win !== -1) return win;
  const block = completes(board, 'X');
  if (block !== -1) return block;
  if (board[4] === null) return 4;
  return free[pick(free.length)] ?? free[0] ?? -1;
}

export interface Tally {
  readonly wins: number;
  readonly draws: number;
  readonly losses: number;
}

export function TicTacToe() {
  const timers = useTimers();
  const [board, setBoard] = useState<Board>(EMPTY);
  const [yours, setYours] = useState(true);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [tally, setTally] = useState<Tally>({ wins: 0, draws: 0, losses: 0 });

  const reset = (): void => {
    setBoard(EMPTY);
    setYours(true);
    setOutcome(null);
  };

  // The opponent plays after the player, and only while the board is open.
  useEffect(() => {
    if (yours || outcome !== null) return undefined;
    return timers.after(THINKS_MS + Math.random() * THINKS_JITTER_MS, () => {
      setBoard((was) => {
        const at = replyTo(was, (count) => Math.floor(Math.random() * count));
        if (at === -1) return was;
        return was.map((square, index) => (index === at ? 'O' : square));
      });
      setYours(true);
    });
  }, [outcome, timers, yours]);

  // The result is read off the board rather than decided by whoever moved last,
  // so a win and a draw are found the same way.
  useEffect(() => {
    if (outcome !== null) return undefined;
    const found = winnerOf(board);
    if (found === null) return undefined;

    setOutcome(found);
    setTally((was) => ({
      wins: was.wins + (found.mark === 'X' ? 1 : 0),
      draws: was.draws + (found.mark === 'draw' ? 1 : 0),
      losses: was.losses + (found.mark === 'O' ? 1 : 0),
    }));
    return timers.after(RESULT_MS, reset);
  }, [board, outcome, timers]);

  const play = (at: number): void => {
    if (board[at] !== null || !yours || outcome !== null) return;
    setBoard(board.map((square, index) => (index === at ? 'X' : square)));
    setYours(false);
  };

  const status =
    outcome?.mark === 'X'
      ? 'You win'
      : outcome?.mark === 'O'
        ? 'The opponent wins'
        : outcome?.mark === 'draw'
          ? 'Draw'
          : yours
            ? 'Your turn'
            : 'Thinking…';

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className="grid grid-cols-3 gap-1.5"
        role="group"
        aria-label="Tic-tac-toe board"
      >
        {board.map((square, at) => (
          <button
            key={at}
            type="button"
            onClick={() => {
              play(at);
            }}
            disabled={square !== null || !yours || outcome !== null}
            aria-label={`Square ${String(at + 1)}${square === null ? '' : `, ${square}`}`}
            className={cn(
              'flex size-14 items-center justify-center rounded-md border text-xl transition-colors',
              'outline-none focus-visible:ring-2 focus-visible:ring-accent',
              'disabled:cursor-default enabled:hover:border-accent-line enabled:hover:bg-accent-soft',
              outcome?.line?.includes(at) === true
                ? 'border-green bg-green-soft text-green'
                : 'border-line bg-surface text-ink',
            )}
          >
            {square === 'X' ? '✕' : square === 'O' ? '○' : ''}
          </button>
        ))}
      </div>
      <p className="text-sm text-muted" aria-live="polite">
        {status}
      </p>
      <p className="font-mono text-xs tabular-nums text-muted">
        W {tally.wins} · D {tally.draws} · L {tally.losses}
      </p>
      <PlayAgain onClick={reset} />
    </div>
  );
}
