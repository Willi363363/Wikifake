// The rules of the six, without a DOM.
//
// Each game keeps its decisions in a pure function — where the head lands, what
// the opponent plays, how a guess graded — because that is the half worth
// asserting on. The components are checked by rendering them, in
// `minigames.test.tsx`; here nothing is mounted and nothing ticks.
import { describe, expect, it } from 'vitest';

import { deal, PAIRS } from './memory-cards.js';
import {
  CELLS,
  drawPattern,
  EASIEST,
  gradeOf,
  HARDEST,
  isPerfect,
  nextDifficulty,
} from './pattern-match.js';
import { FAIR_MS, QUICK_MS, toneFor } from './reaction-speed.js';
import { advance, GRID, speedAt, steerTo, type Body } from './snake.js';
import { jump, LANE, PEAK, START, tick, type Dash } from './dino-run.js';
import { EMPTY, replyTo, winnerOf, type Board } from './tic-tac-toe.js';

const EAST = { x: 1, y: 0 };

describe('snake', () => {
  it('moves the head, and drags the tail after it', () => {
    const move = advance([{ x: 10, y: 10 }], EAST, { x: 15, y: 15 });
    expect(move).toEqual({ alive: true, ate: false, body: [{ x: 11, y: 10 }] });
  });

  it('dies against a wall', () => {
    expect(advance([{ x: GRID - 1, y: 10 }], EAST, { x: 0, y: 0 })).toEqual({
      alive: false,
    });
  });

  it('dies against itself', () => {
    const body: Body = [
      { x: 5, y: 5 },
      { x: 6, y: 5 },
      { x: 6, y: 6 },
    ];
    expect(advance(body, EAST, { x: 0, y: 0 })).toEqual({ alive: false });
  });

  it('grows, and only grows, on the food', () => {
    const move = advance([{ x: 14, y: 15 }], EAST, { x: 15, y: 15 });
    expect(move).toEqual({
      alive: true,
      ate: true,
      body: [
        { x: 15, y: 15 },
        { x: 14, y: 15 },
      ],
    });
  });

  it('keeps its length when there is nothing to eat', () => {
    const body: Body = [
      { x: 5, y: 5 },
      { x: 4, y: 5 },
      { x: 3, y: 5 },
    ];
    const move = advance(body, EAST, { x: 20, y: 20 });
    expect(move.alive && move.body).toHaveLength(3);
  });

  it('steers on the arrows and on WASD alike', () => {
    expect(steerTo(EAST, 'ArrowDown')).toEqual({ x: 0, y: 1 });
    expect(steerTo(EAST, 's')).toEqual({ x: 0, y: 1 });
  });

  it('ignores a key that is not a direction', () => {
    expect(steerTo(EAST, 'Enter')).toBeNull();
    expect(steerTo(EAST, 'q')).toBeNull();
  });

  it('refuses to reverse onto itself', () => {
    // Allowing it would make the left arrow, while heading right, a key that
    // ends the game.
    expect(steerTo(EAST, 'ArrowLeft')).toBeNull();
    expect(steerTo(EAST, 'ArrowRight')).toBeNull();
    expect(steerTo({ x: 0, y: 1 }, 'ArrowUp')).toBeNull();
  });

  it('quickens with the score, down to a floor', () => {
    expect(speedAt(0)).toBe(150);
    expect(speedAt(10)).toBe(100);
    // A score of a hundred does not make the tick instantaneous.
    expect(speedAt(100)).toBe(60);
  });
});

describe('agent dash', () => {
  it('carries the obstacle towards the runner', () => {
    expect(tick(START, LANE).obstacleX).toBe(LANE - START.speed);
  });

  it('leaves the ground once, and not twice', () => {
    const leapt = jump(START);
    expect(leapt.airborne).toBe(true);
    // A second press mid-air is not a second jump.
    expect(jump(leapt)).toBe(leapt);
  });

  it('climbs to the peak, then comes back down', () => {
    let world = jump(START);
    for (let frame = 0; frame < 200 && world.height < PEAK; frame += 1) {
      world = tick(world, LANE);
    }
    expect(world.height).toBe(PEAK);
    expect(world.rising).toBe(false);

    for (let frame = 0; frame < 200 && world.airborne; frame += 1) {
      world = tick(world, LANE);
    }
    expect(world.height).toBe(0);
    expect(world.airborne).toBe(false);
  });

  it('is over when an obstacle is reached on the ground', () => {
    const world: Dash = { ...START, obstacleX: 48 };
    expect(tick(world, LANE).over).toBe(true);
  });

  it('is not over when the obstacle is cleared', () => {
    const world: Dash = { ...START, obstacleX: 48, height: 40, airborne: true };
    expect(tick(world, LANE).over).toBe(false);
  });

  it('scores an obstacle passed, and speeds up for the next', () => {
    const world: Dash = { ...START, obstacleX: -18 };
    const next = tick(world, 400);
    expect(next.obstacleX).toBe(400);
    expect(next.score).toBe(100);
    expect(next.speed).toBeGreaterThan(START.speed);
  });

  it('changes nothing once it is over', () => {
    const done: Dash = { ...START, over: true };
    expect(tick(done, LANE)).toBe(done);
  });
});

describe('tic-tac-toe', () => {
  const board = (marks: string): Board =>
    [...marks].map((mark) => (mark === 'X' || mark === 'O' ? mark : null));

  it('finds a winner, and says which line won', () => {
    expect(winnerOf(board('XXX.O.O..'))).toEqual({ mark: 'X', line: [0, 1, 2] });
  });

  it('finds a draw only when the board is full', () => {
    expect(winnerOf(board('XOXXOOOXX'))).toEqual({ mark: 'draw', line: null });
    expect(winnerOf(board('XOX.OOOXX'))).toBeNull();
  });

  it('has nothing to say about an open board', () => {
    expect(winnerOf(EMPTY)).toBeNull();
  });

  it('takes the win when it has one', () => {
    expect(replyTo(board('OO..X.X..'), () => 0)).toBe(2);
  });

  it('blocks the loss when it has no win', () => {
    expect(replyTo(board('XX..O....'), () => 0)).toBe(2);
  });

  it('takes the centre when there is nothing to settle', () => {
    expect(replyTo(EMPTY, () => 0)).toBe(4);
  });

  it('otherwise plays where it is told', () => {
    // Centre taken, no line of two: it falls through to the free squares, and
    // `pick` decides which.
    const open = board('X...O....');
    const free = [1, 2, 3, 5, 6, 7, 8];
    expect(free).toContain(replyTo(open, () => 3));
    expect(replyTo(open, () => 3)).toBe(free[3]);
  });

  it('has nothing to play on a full board', () => {
    expect(replyTo(board('XOXXOOOXX'), () => 0)).toBe(-1);
  });
});

describe('memory cards', () => {
  it('deals two of every icon, and nothing else', () => {
    const cards = deal(() => 0);
    expect(cards).toHaveLength(PAIRS * 2);

    const seen = new Map<string, number>();
    for (const card of cards) seen.set(card.icon, (seen.get(card.icon) ?? 0) + 1);
    expect(seen.size).toBe(PAIRS);
    expect([...seen.values()]).toEqual(Array.from({ length: PAIRS }, () => 2));
  });

  it('deals nothing already matched', () => {
    expect(deal(() => 0).some((card) => card.matched)).toBe(false);
  });

  it('shuffles with the choice it is handed', () => {
    // A `pick` that always returns 0 walks every card past the first position,
    // which is a permutation and not the identity.
    const shuffled = deal(() => 0).map((card) => card.icon);
    const dealt = deal((below) => below - 1).map((card) => card.icon);
    expect(shuffled).not.toEqual(dealt);
  });
});

describe('pattern match', () => {
  it('marks what was right, what was invented, and what was forgotten', () => {
    const marks = gradeOf(new Set([1, 2]), new Set([1, 3]));
    expect([...marks.entries()].sort()).toEqual([
      [1, 'correct'],
      [2, 'missed'],
      [3, 'wrong'],
    ]);
  });

  it('says nothing about a square nobody touched', () => {
    expect(gradeOf(new Set([1]), new Set([1])).has(5)).toBe(false);
  });

  it('is perfect only when nothing is invented and nothing forgotten', () => {
    expect(isPerfect(gradeOf(new Set([1, 2]), new Set([1, 2])))).toBe(true);
    expect(isPerfect(gradeOf(new Set([1, 2]), new Set([1, 3])))).toBe(false);
    expect(isPerfect(gradeOf(new Set([1, 2]), new Set([1])))).toBe(false);
  });

  it('moves with the player, and stays inside its bounds', () => {
    expect(nextDifficulty(EASIEST, true)).toBe(EASIEST + 1);
    expect(nextDifficulty(EASIEST, false)).toBe(EASIEST);
    expect(nextDifficulty(HARDEST, true)).toBe(HARDEST);
    expect(nextDifficulty(HARDEST, false)).toBe(HARDEST - 1);
  });

  it('draws the number of squares it was asked for, all distinct', () => {
    // A `pick` that repeats itself before moving on: the draw has to keep going
    // rather than hand back a pattern one square short.
    const sequence = [3, 3, 7, 7, 11, 2, 2, 9, 14, 0, 0, 5];
    let at = -1;
    const pattern = drawPattern(HARDEST, () => {
      at += 1;
      return sequence[at % sequence.length] ?? 0;
    });
    expect(pattern.size).toBe(HARDEST);
    for (const square of pattern) {
      expect(square).toBeGreaterThanOrEqual(0);
      expect(square).toBeLessThan(CELLS);
    }
  });
});

describe('reaction speed', () => {
  it('grades a time against the two thresholds', () => {
    expect(toneFor(QUICK_MS - 1)).toBe('green');
    expect(toneFor(QUICK_MS)).toBe('accent');
    expect(toneFor(FAIR_MS - 1)).toBe('accent');
    expect(toneFor(FAIR_MS)).toBe('bronze');
  });
});
