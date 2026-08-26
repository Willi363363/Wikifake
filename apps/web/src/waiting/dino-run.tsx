'use client';

// Agent Dash: the endless runner, jumping over what comes at it.
//
// The current one runs two clocks — a 20 ms game loop, plus a second interval
// opened per jump to move the runner up and down — and the jump interval is
// cancelled only when the jump finishes. Leave the screen mid-air and it goes
// on ticking. Here the jump is part of the same tick, with the same numbers, so
// there is one clock and the physics is a pure function of the last frame.
import { useEffect, useState } from 'react';

import { GameOver } from './controls.js';
import { useTimers } from './timers.js';

/** The frame, in milliseconds. The current loop's, kept: 50 frames a second. */
export const TICK_MS = 20;

/** Where an obstacle enters, in pixels from the runner's left edge. */
export const LANE = 320;

/** The top of a jump, and how much of it is gained per frame. */
export const PEAK = 60;
const CLIMB = 5;

/** The runner's box, and the height it has to reach to clear an obstacle. */
const RUNNER = { from: 30, to: 50 };
const OBSTACLE_WIDTH = 12;
const CLEARANCE = 24;

export interface Dash {
  /** The obstacle's left edge. */
  readonly obstacleX: number;
  /** Pixels per frame, which grows with every obstacle passed. */
  readonly speed: number;
  readonly height: number;
  readonly rising: boolean;
  readonly airborne: boolean;
  readonly score: number;
  readonly over: boolean;
}

export const START: Dash = {
  obstacleX: LANE,
  speed: 4,
  height: 0,
  rising: false,
  airborne: false,
  score: 0,
  over: false,
};

/**
 * One frame.
 *
 * `respawnAt` is passed in rather than drawn here, so a test can say where the
 * next obstacle appears and the component can keep the current game's jitter.
 */
export function tick(world: Dash, respawnAt: number): Dash {
  if (world.over) return world;

  let height = world.height;
  let rising = world.rising;
  let airborne = world.airborne;
  if (airborne) {
    height += rising ? CLIMB : -CLIMB;
    if (height >= PEAK) {
      height = PEAK;
      rising = false;
    }
    if (height <= 0) {
      height = 0;
      airborne = false;
    }
  }

  let obstacleX = world.obstacleX - world.speed;
  let speed = world.speed;
  let score = world.score;
  if (obstacleX < -OBSTACLE_WIDTH - 8) {
    obstacleX = respawnAt;
    score += 100;
    // The only difficulty curve there is, and it is enough: a run that lasts
    // ends because it got fast, not because the player got bored.
    speed += 0.2;
  }

  const overlapping = obstacleX < RUNNER.to && obstacleX + OBSTACLE_WIDTH > RUNNER.from;
  return {
    obstacleX,
    speed,
    height,
    rising,
    airborne,
    score,
    over: overlapping && height < CLEARANCE,
  };
}

/** Leaves the ground, if it is on the ground and the run is still going. */
export function jump(world: Dash): Dash {
  if (world.airborne || world.over) return world;
  return { ...world, airborne: true, rising: true };
}

export function DinoRun() {
  const timers = useTimers();
  const [world, setWorld] = useState<Dash>(START);

  const leap = (): void => {
    setWorld(jump);
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.code !== 'Space' && event.code !== 'ArrowUp') return;
      // Space scrolls the page, and a player jumping does not expect to move
      // the screen as well.
      event.preventDefault();
      leap();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  useEffect(() => {
    if (world.over) return undefined;
    return timers.every(TICK_MS, () => {
      setWorld((was) => tick(was, LANE + Math.random() * 100));
    });
  }, [world.over, timers]);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-full max-w-[320px]">
        {/* A button, not a div with an onClick: tapping to jump has to work,
            and so does pressing Enter on it. */}
        <button
          type="button"
          onClick={leap}
          aria-label="Jump"
          className="relative h-28 w-full overflow-hidden rounded-md border border-line bg-bg-grain outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <span className="absolute inset-x-0 bottom-[22px] block h-px bg-line-strong" />
          <span
            className="absolute block size-5 rounded-xs bg-accent"
            style={{ left: RUNNER.from, bottom: 22 + world.height }}
          />
          <span
            className="absolute bottom-[22px] block h-6 rounded-xs bg-danger"
            style={{ width: OBSTACLE_WIDTH, left: world.obstacleX }}
          />
        </button>
        {world.over ? (
          <GameOver
            onRestart={() => {
              setWorld(START);
            }}
          />
        ) : null}
      </div>
      <p className="font-mono text-xs tabular-nums text-muted" aria-live="polite">
        Score {world.score}
      </p>
      <p className="text-xs text-muted">Tap, space or up to jump</p>
    </div>
  );
}
