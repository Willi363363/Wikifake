// D4 — the server enforces the end of a round.
//
// Today `time_limit` is applied by the client alone: a round nobody submits to
// stays open for ever, and a room whose last player vanished is never collected.
// The reducer already decides *when* — it returns `arm_timer` and `cancel_timer`
// as values — and this is the port that makes those values happen.
//
// A queue rather than `setTimeout`, and the difference is the point: a timeout
// lives in one process, so a redeployment silently forgets every round in
// flight, and a round armed on instance A cannot be cancelled by instance B. A
// delayed job survives both.

/**
 * What a fired alarm is about.
 *
 * Two of the three become events the reducer already understands. `room_idle`
 * is not a rule: nobody is left to be told anything, so it is a clean-up rather
 * than a transition.
 */
export type TimerKind = 'round_end' | 'item_wave' | 'room_idle';

export interface Alarm {
  readonly roomCode: string;
  readonly kind: TimerKind;
  /** Which wave this is, for `item_wave`. Absent otherwise. */
  readonly wave?: number;
}

export interface Scheduler {
  /**
   * Rings this alarm in `delayMs`, replacing any alarm of the same kind on the
   * same room.
   *
   * Replacing rather than adding is the phase's last pitfall: a round-end job
   * left behind by a round that ended early fires during the next one. Keyed on
   * (room, kind), so there can only ever be one.
   */
  arm(alarm: Alarm, delayMs: number): Promise<void>;
  /** @param wave which wave to drop, for the one kind there are several of. */
  cancel(roomCode: string, kind: TimerKind, wave?: number): Promise<void>;
  /** Stops consuming and lets go of the connections. */
  close(): Promise<void>;
}

/** What happens when an alarm rings. Injected, so the queue owns no rules. */
export type OnAlarm = (alarm: Alarm) => Promise<void>;

/**
 * `A1B2C3-round_end`, or `A1B2C3-item_wave-3` — one alarm per room and kind, and
 * one per wave for the kind there are several of.
 *
 * The waves are numbered because they are armed together, at fixed offsets, and
 * a single id would collide with itself: BullMQ will not remove a job that is
 * running, so a wave arming its successor under its own id from inside its own
 * handler is quietly ignored.
 *
 * A hyphen rather than a colon: BullMQ refuses a custom job id containing one,
 * because a colon is what separates the parts of its own keys. Room codes are
 * upper-case letters and digits and kinds are snake_case, so a hyphen appears in
 * neither half and the two stay unambiguous.
 */
export function alarmId(roomCode: string, kind: TimerKind, wave?: number): string {
  return wave === undefined
    ? `${roomCode}-${kind}`
    : `${roomCode}-${kind}-${String(wave)}`;
}
