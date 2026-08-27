// What a fired alarm does.
//
// Each one becomes an event the reducer already understands, or — for an idle
// room — nothing the room can be told: there is nobody left, the state has
// expired with its key, and what is left to do is stop the other alarms ringing
// against a room somebody may rebuild under the same code.
//
// Its own file because it is the one part of the service that runs with nobody
// waiting on it: an alarm has no socket to answer and no caller to fail back to,
// so what it does has to be readable on its own.
import type { RoomStore } from '../rooms/store.js';
import type { TokenStore } from '../rooms/tokens.js';
import type { Alarm, Scheduler } from './scheduler.js';
import { drawWave } from './waves.js';

type RoomEvent = Parameters<RoomStore['apply']>[1];

export interface Ringing {
  /** Settles an event against the room, exactly as a socket's message would. */
  settle(roomCode: string, event: RoomEvent): Promise<void>;
  readonly rooms: RoomStore;
  /** D5 — a claim outlives its player only until the grace window closes. */
  readonly tokens: TokenStore;
  /** C1.8, D4 — the room is over. */
  closeRoom(roomCode: string): Promise<void>;
  /** Which item a wave draws. Pinned by the tests; random in production. */
  readonly pick: (upperBound: number) => number;
  /**
   * The scheduler, lazily.
   *
   * A getter rather than the object: the scheduler is built *from* the handler
   * this function returns, so it does not exist yet when this is called.
   */
  scheduler(): Scheduler;
}

export function createRinging(ringing: Ringing): (alarm: Alarm) => Promise<void> {
  return async function rang(alarm: Alarm): Promise<void> {
    if (alarm.kind === 'room_idle') {
      await ringing.scheduler().cancel(alarm.roomCode, 'round_end');
      // D4 — the other end of a room's life, and the one nothing decides: there
      // is nobody left to evict, so no event ever says the room is over. The
      // state has expired with its key; the row has not.
      await ringing.closeRoom(alarm.roomCode);
      return;
    }

    // D5 — the grace window ran out. Now, and only now, is the player gone: the
    // round may end on it, the host may pass, and the room may close.
    if (alarm.kind === 'grace') {
      const player = alarm.player;
      if (player === undefined) return;

      await ringing.settle(alarm.roomCode, { kind: 'evict', player });
      // Their claim on the nickname goes with them. Left behind, it would keep
      // the slot locked for a player who is not coming back.
      await ringing.tokens.forget(alarm.roomCode, player);
      return;
    }

    if (alarm.kind === 'round_end') {
      await ringing.settle(alarm.roomCode, { kind: 'timer_expired' });
      return;
    }

    const wave = alarm.wave ?? 1;
    const held = await ringing.rooms.read(alarm.roomCode);
    // A wave for a round that is over is a wave nobody wants: the alarm outlived
    // its round, which `cancel_timer` normally prevents and a crash does not.
    if (held.state.phase !== 'round') return;

    await ringing.settle(alarm.roomCode, {
      kind: 'items_granted',
      wave,
      grants: drawWave(
        held.state.players.map((player) => player.name),
        wave,
        ringing.pick,
      ),
    });
  };
}
