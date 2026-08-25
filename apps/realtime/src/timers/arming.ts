// Which alarms a settled event leaves behind.
//
// The reducer marks the two ends of a round with `arm_timer` and `cancel_timer`.
// Those are the only two signals needed: a round that has started has a
// deadline and, if it is playing with items, a first wave; a round that has
// ended has neither. Reading the phase instead would mean comparing it to what
// it was, and the effects already say what changed.
//
// The idle alarm is re-armed on **every** event, which is what "idle" means: the
// clock restarts whenever somebody does something.
import type { RoomEffect, RoomState } from '@wikifake/domain';

import type { Scheduler } from './scheduler.js';
import { WAVE_INTERVAL_SECONDS, WAVES_PER_ROUND } from './waves.js';

/** Every wave of a round, dropped together. */
async function cancelWaves(
  scheduler: Armed['scheduler'],
  roomCode: string,
): Promise<void> {
  for (let wave = 1; wave <= WAVES_PER_ROUND; wave += 1) {
    await scheduler.cancel(roomCode, 'item_wave', wave);
  }
}

export interface Armed {
  readonly scheduler: Scheduler;
  /** How long a room with nothing happening in it survives. */
  readonly idleSeconds: number;
}

/**
 * Arms and cancels what this transition implies.
 *
 * The phase's last pitfall lives here: a round-end alarm left behind by a round
 * that ended early fires during the next one. `cancel_timer` drops it, and
 * arming replaces rather than adds, so there is never more than one.
 */
export async function armFor(
  armed: Armed,
  roomCode: string,
  state: RoomState,
  effects: readonly RoomEffect[],
): Promise<void> {
  for (const effect of effects) {
    if (effect.kind === 'arm_timer') {
      await armed.scheduler.arm({ roomCode, kind: 'round_end' }, effect.seconds * 1000);

      // All nine at once, at thirty-second offsets. The first is thirty seconds
      // in, so a round opens item-free — the current loop sleeps before its
      // first distribution, and that is a rule rather than an implementation
      // detail.
      //
      // Armed together rather than chained, because a wave cannot arm its
      // successor: BullMQ will not remove a running job, so an alarm re-arming
      // its own id from inside its own handler is quietly ignored. The schedule
      // is fixed anyway — nine waves at known offsets — so there is nothing to
      // decide as it goes.
      if (state.options.withItems) {
        for (let wave = 1; wave <= WAVES_PER_ROUND; wave += 1) {
          await armed.scheduler.arm(
            { roomCode, kind: 'item_wave', wave },
            WAVE_INTERVAL_SECONDS * wave * 1000,
          );
        }
      }
    }

    if (effect.kind === 'cancel_timer') {
      await armed.scheduler.cancel(roomCode, 'round_end');
      await cancelWaves(armed.scheduler, roomCode);
    }
  }

  // A room that has just been forgotten has nothing left to ring for. Cancelled
  // rather than left to fire against a room somebody rebuilt under the same
  // code — which is the same defect as the round-end job, one scope up.
  if (effects.some((effect) => effect.kind === 'close_room')) {
    await armed.scheduler.cancel(roomCode, 'round_end');
    await cancelWaves(armed.scheduler, roomCode);
    await armed.scheduler.cancel(roomCode, 'room_idle');
    return;
  }

  await armed.scheduler.arm({ roomCode, kind: 'room_idle' }, armed.idleSeconds * 1000);
}
