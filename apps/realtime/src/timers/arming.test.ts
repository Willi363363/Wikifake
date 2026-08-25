// What a settled transition leaves armed, against a scheduler that records.
//
// `timers.test.ts` proves the alarms ring, over a real queue on a real Redis.
// This proves they are armed for the right delays — which cannot be checked
// there, because the suite shortens them to keep the wait bearable.
//
// The phase's last pitfall lives in the third test: a round-end alarm left
// behind by a round that ended early fires during the next one.
import { emptyRoom, type RoomEffect, type RoomState } from '@wikifake/domain';
import { describe, expect, it } from 'vitest';

import { armFor } from './arming.js';
import { WAVE_INTERVAL_SECONDS, WAVES_PER_ROUND } from './waves.js';
import type { Alarm, Scheduler, TimerKind } from './scheduler.js';

interface Armed {
  readonly alarm: Alarm;
  readonly delayMs: number;
}

interface Cancelled {
  readonly roomCode: string;
  readonly kind: TimerKind;
  readonly wave: number | undefined;
}

function recorder(): Scheduler & {
  readonly armed: Armed[];
  readonly cancelled: Cancelled[];
} {
  const armed: Armed[] = [];
  const cancelled: Cancelled[] = [];

  return {
    armed,
    cancelled,
    arm: (alarm, delayMs) => {
      armed.push({ alarm, delayMs });
      return Promise.resolve();
    },
    cancel: (roomCode, kind, wave) => {
      cancelled.push({ roomCode, kind, wave });
      return Promise.resolve();
    },
    close: () => Promise.resolve(),
  };
}

const ROOM = 'A1B2C3';
const IDLE = 3600;

const playing = (withItems: boolean): RoomState => ({
  ...emptyRoom(),
  phase: 'round',
  options: { withItems, timeLimit: 300 },
});

const of = (armed: Armed[], kind: TimerKind): Armed[] =>
  armed.filter((each) => each.alarm.kind === kind);

describe('what a round starting arms', () => {
  it('arms the deadline the room chose, in seconds', async () => {
    const scheduler = recorder();
    await armFor({ scheduler, idleSeconds: IDLE }, ROOM, playing(false), [
      { kind: 'arm_timer', seconds: 120 },
    ]);

    expect(of(scheduler.armed, 'round_end')).toEqual([
      { alarm: { roomCode: ROOM, kind: 'round_end' }, delayMs: 120_000 },
    ]);
  });

  // The first wave is thirty seconds in, so a round opens item-free — the
  // current loop sleeps before its first distribution, and that is a rule.
  it('arms every wave at once, at its own offset', async () => {
    const scheduler = recorder();
    await armFor({ scheduler, idleSeconds: IDLE }, ROOM, playing(true), [
      { kind: 'arm_timer', seconds: 300 },
    ]);

    const waves = of(scheduler.armed, 'item_wave');
    expect(waves).toHaveLength(WAVES_PER_ROUND);
    expect(waves[0]?.delayMs).toBe(WAVE_INTERVAL_SECONDS * 1000);
    expect(waves.at(-1)?.delayMs).toBe(WAVES_PER_ROUND * WAVE_INTERVAL_SECONDS * 1000);
    expect(waves.map((each) => each.alarm.wave)).toEqual(
      Array.from({ length: WAVES_PER_ROUND }, (_value, at) => at + 1),
    );
  });

  it('arms no wave for a round played without items', async () => {
    const scheduler = recorder();
    await armFor({ scheduler, idleSeconds: IDLE }, ROOM, playing(false), [
      { kind: 'arm_timer', seconds: 300 },
    ]);

    expect(of(scheduler.armed, 'item_wave')).toEqual([]);
  });
});

describe('what a round ending drops', () => {
  // The pitfall, in one test.
  it('drops the deadline and every wave', async () => {
    const scheduler = recorder();
    await armFor({ scheduler, idleSeconds: IDLE }, ROOM, playing(true), [
      { kind: 'cancel_timer' },
    ]);

    expect(scheduler.cancelled.filter((each) => each.kind === 'round_end')).toHaveLength(
      1,
    );
    expect(scheduler.cancelled.filter((each) => each.kind === 'item_wave')).toHaveLength(
      WAVES_PER_ROUND,
    );
  });

  // A room somebody rebuilds under the same code must not inherit its alarms.
  it('drops everything when the room is forgotten, and arms nothing', async () => {
    const scheduler = recorder();
    const effects: RoomEffect[] = [{ kind: 'cancel_timer' }, { kind: 'close_room' }];

    await armFor({ scheduler, idleSeconds: IDLE }, ROOM, emptyRoom(), effects);

    expect(scheduler.cancelled.some((each) => each.kind === 'room_idle')).toBe(true);
    expect(scheduler.armed).toEqual([]);
  });
});

describe('the idle clock', () => {
  // What "idle" means: the clock restarts whenever somebody does something.
  it('restarts on any event at all', async () => {
    const scheduler = recorder();
    await armFor({ scheduler, idleSeconds: IDLE }, ROOM, emptyRoom(), []);

    expect(of(scheduler.armed, 'room_idle')).toEqual([
      { alarm: { roomCode: ROOM, kind: 'room_idle' }, delayMs: IDLE * 1000 },
    ]);
  });

  it('restarts alongside a round starting', async () => {
    const scheduler = recorder();
    await armFor({ scheduler, idleSeconds: IDLE }, ROOM, playing(false), [
      { kind: 'arm_timer', seconds: 300 },
    ]);

    expect(of(scheduler.armed, 'room_idle')).toHaveLength(1);
  });
});
