// The harness the room tests share.
//
// Its own file because both test files need it and the alternative is either a
// 500-line test file or the same twenty lines twice. It builds events and reads
// outcomes; it asserts nothing.
import type { ErrorCode, IncomingMessage, OutgoingMessage } from '@wikifake/protocol';

import type { RoomEffect, RoomEvent } from './events.js';
import { reduceLobby } from './lobby.js';
import { emptyRoom, type RoomState } from './state.js';

export interface Outcome {
  readonly state: RoomState;
  readonly effects: readonly RoomEffect[];
}

/** Runs a sequence of events, returning the final state and the last effects. */
export function run(
  events: readonly RoomEvent[],
  from: RoomState = emptyRoom(),
): Outcome {
  let state = from;
  let effects: readonly RoomEffect[] = [];
  for (const event of events) {
    const outcome = reduceLobby(state, event);
    state = outcome.state;
    effects = outcome.effects;
  }
  return { state, effects };
}

export const joined = (...names: readonly string[]): RoomEvent[] =>
  names.map((player) => ({ kind: 'join', player }) as const);

export const says = (from: string, message: IncomingMessage, seed = 0): RoomEvent => ({
  kind: 'message',
  from,
  message,
  seed,
});

/** The code an outcome refused with, or null if it did not refuse. */
export function refusal(effects: readonly RoomEffect[]): ErrorCode | null {
  for (const effect of effects) {
    if (effect.kind === 'send' && effect.message.type === 'error')
      return effect.message.code;
  }
  return null;
}

export function broadcasts(effects: readonly RoomEffect[]): OutgoingMessage[] {
  return effects
    .filter((effect) => effect.kind === 'broadcast')
    .map((effect) => effect.message);
}
