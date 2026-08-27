// A scheduler that never leaves the process.
//
// For the suites that are not about surviving a redeployment — the transport's,
// the room's — and for the ones that are about *what* an alarm does rather than
// *where* it is kept. `timers.test.ts` runs the BullMQ one against a real Redis,
// which is where the step's criterion lives.
//
// Not a stand-in, and not usable in production for the reason the step exists:
// a `setTimeout` dies with its process, so a redeployment forgets every round in
// flight, and an alarm armed on one instance cannot be cancelled by another.
import {
  alarmId,
  type Alarm,
  type OnAlarm,
  type Scheduler,
  type TimerKind,
} from './scheduler.js';

export function createLocalScheduler(onAlarm: OnAlarm): Scheduler {
  const armed = new Map<string, ReturnType<typeof setTimeout>>();

  const drop = (id: string): void => {
    const held = armed.get(id);
    if (held !== undefined) {
      clearTimeout(held);
      armed.delete(id);
    }
  };

  return {
    arm(alarm: Alarm, delayMs: number) {
      const id = alarmId(alarm.roomCode, alarm.kind, alarm.wave ?? alarm.player);
      // Replaces, like the queue: one alarm of each kind per room, never two.
      drop(id);

      const timer = setTimeout(() => {
        armed.delete(id);
        void onAlarm(alarm);
      }, delayMs);
      // The suite must not be held open by a room's idle alarm an hour away.
      timer.unref?.();

      armed.set(id, timer);
      return Promise.resolve();
    },

    cancel(roomCode: string, kind: TimerKind, of?: string | number) {
      drop(alarmId(roomCode, kind, of));
      return Promise.resolve();
    },

    close() {
      for (const timer of armed.values()) clearTimeout(timer);
      armed.clear();
      return Promise.resolve();
    },
  };
}
