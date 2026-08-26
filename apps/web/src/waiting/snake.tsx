'use client';

// Snake, on a 24 by 24 grid of absolutely positioned cells.
//
// The move is arithmetic — `advance` — because that is the part worth a test:
// where the head lands, what kills it, and when it grows. The component only
// paints the result and owns the clock.
import { useEffect, useRef, useState } from 'react';

import { GameOver } from './controls.js';
import { useTimers } from './timers.js';

/** The board, in cells, and a cell, in pixels. */
export const GRID = 24;
const CELL = 10;

export interface Cell {
  readonly x: number;
  readonly y: number;
}

/** Never empty: the head is `body[0]`, and there is always a head. */
export type Body = readonly [Cell, ...Cell[]];

export type Move =
  | { readonly alive: true; readonly body: Body; readonly ate: boolean }
  | { readonly alive: false };

/**
 * One tick of the snake.
 *
 * A wall or its own body ends it; the food lengthens it; anything else moves it
 * along. The tail counts as its own body even though it is about to vacate the
 * square — that is the current game's rule, and the same board plays the same
 * way here.
 */
export function advance(body: Body, heading: Cell, food: Cell): Move {
  const head = { x: body[0].x + heading.x, y: body[0].y + heading.y };
  const outside = head.x < 0 || head.x >= GRID || head.y < 0 || head.y >= GRID;
  const into = body.some((cell) => cell.x === head.x && cell.y === head.y);
  if (outside || into) return { alive: false };

  const ate = head.x === food.x && head.y === food.y;
  return {
    alive: true,
    ate,
    body: ate ? [head, ...body] : [head, ...body.slice(0, -1)],
  };
}

/** The tick, in milliseconds: quicker as the score climbs, down to a floor. */
export function speedAt(score: number): number {
  return Math.max(60, 150 - score * 5);
}

/** Which way a key steers. Absent from the map means "not a steering key". */
export const HEADINGS: Record<string, Cell> = {
  ArrowUp: { x: 0, y: -1 },
  w: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  s: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  a: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  d: { x: 1, y: 0 },
};

const START: Body = [{ x: 10, y: 10 }];
const EAST: Cell = { x: 1, y: 0 };

/**
 * The heading a key asks for, or null if it asks for nothing legal.
 *
 * A turn has to change the axis: reversing onto yourself is a key press that
 * ends the game, which is not what the player meant by pressing it.
 */
export function steerTo(heading: Cell, key: string): Cell | null {
  const to = HEADINGS[key];
  if (to === undefined) return null;
  const reversing = (to.x !== 0 && heading.x !== 0) || (to.y !== 0 && heading.y !== 0);
  return reversing ? null : to;
}

const somewhere = (): Cell => ({
  x: Math.floor(Math.random() * GRID),
  y: Math.floor(Math.random() * GRID),
});

export function Snake() {
  const timers = useTimers();
  const [body, setBody] = useState<Body>(START);
  const [food, setFood] = useState<Cell>({ x: 15, y: 15 });
  const [score, setScore] = useState(0);
  const [over, setOver] = useState(false);
  // The heading is a ref, not state. Held in state, every key press restarts
  // the interval and so resets its phase — which lets a player who mashes the
  // arrows move faster than the tick allows.
  const heading = useRef<Cell>(EAST);

  const restart = (): void => {
    setBody(START);
    setFood(somewhere());
    setScore(0);
    setOver(false);
    heading.current = EAST;
  };

  useEffect(() => {
    const steer = (event: KeyboardEvent): void => {
      const to = steerTo(heading.current, event.key);
      if (to === null) return;
      // The arrows scroll the waiting screen otherwise, which is not what a
      // player pressing them is asking for.
      event.preventDefault();
      heading.current = to;
    };
    window.addEventListener('keydown', steer);
    return () => {
      window.removeEventListener('keydown', steer);
    };
  }, []);

  useEffect(() => {
    if (over) return undefined;
    return timers.every(speedAt(score), () => {
      setBody((was) => {
        const move = advance(was, heading.current, food);
        if (!move.alive) {
          setOver(true);
          return was;
        }
        if (move.ate) {
          setScore((was_) => was_ + 1);
          setFood(somewhere());
        }
        return move.body;
      });
    });
  }, [food, over, score, timers]);

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="relative overflow-hidden rounded-md border border-line bg-bg-grain"
        style={{ width: GRID * CELL, height: GRID * CELL }}
        // A board of positioned squares says nothing to a screen reader, so it
        // says this instead.
        role="img"
        aria-label={`Snake, ${body.length} long`}
      >
        <div
          className="absolute rounded-full bg-danger"
          style={{
            width: CELL - 2,
            height: CELL - 2,
            left: food.x * CELL + 1,
            top: food.y * CELL + 1,
          }}
        />
        {body.map((cell, at) => (
          <div
            key={`${String(cell.x)}-${String(cell.y)}-${String(at)}`}
            className="absolute rounded-xs bg-accent"
            style={{
              width: CELL - 1,
              height: CELL - 1,
              left: cell.x * CELL,
              top: cell.y * CELL,
            }}
          />
        ))}
        {over ? <GameOver onRestart={restart} /> : null}
      </div>
      <p className="font-mono text-xs tabular-nums text-muted" aria-live="polite">
        Score {score}
      </p>
      <p className="text-xs text-muted">Arrows or WASD to steer</p>
    </div>
  );
}
