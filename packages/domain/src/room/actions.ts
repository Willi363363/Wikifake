// What a player does during a round: spend an item, buy a hint, move, show off.
//
// Every one of these ends in a refusal or an effect. The current handlers return
// early on anything unexpected — an item that is not in your hand, a hint number
// that does not exist — so a client that lost track of its own state gets no
// correction and no clue.
import type { ItemId, OutgoingMessage } from '@wikifake/protocol';

import { grantHint } from '../hints.js';
import { applyItemToTarget, areHintsBlocked, scan, validateTargets } from '../items.js';
import { emit, type Reduced } from '../reducer.js';
import type { RoomEffect } from './events.js';
import { playerIn, type PlayerState, type RoomState } from './state.js';

type Outcome = Reduced<RoomState, RoomEffect>;

function refuse(
  state: RoomState,
  to: string,
  code: RefusalCode,
  message: string,
): Outcome {
  return emit<RoomState, RoomEffect>(state, {
    kind: 'send',
    to,
    message: { type: 'error', code, message },
  });
}

type RefusalCode = Extract<OutgoingMessage, { type: 'error' }>['code'];

function replacePlayer(state: RoomState, updated: PlayerState): RoomState {
  return {
    ...state,
    players: state.players.map((player) =>
      player.name === updated.name ? updated : player,
    ),
  };
}

/**
 * C1.4, C1.5 — buys a hint.
 *
 * The block is checked against the round clock rather than a wall clock: item
 * state counts in seconds since the round began, so nothing here reads a date.
 */
export function unlockHint(
  state: RoomState,
  from: string,
  falseInfoNumber: number,
  level: 1 | 2,
  elapsedSeconds: number,
): Outcome {
  const round = state.round;
  const player = playerIn(state, from);
  if (round === null || player === undefined) return refuseUnknown(state, from);

  const grant = grantHint(
    round.solution,
    player.hints,
    { falseInfoNumber, level },
    { blocked: areHintsBlocked(player.items, elapsedSeconds) },
  );

  if (!grant.ok) {
    return refuse(
      state,
      from,
      grant.code,
      grant.code === 'hints_blocked' ? 'your hints are jammed' : 'no such falsification',
    );
  }

  return emit<RoomState, RoomEffect>(
    replacePlayer(state, { ...player, hints: grant.ledger }),
    {
      kind: 'send',
      to: from,
      message: { type: 'hint_unlocked', ...grant.payload },
    },
  );
}

/**
 * D6, C1.6 — spends an item.
 *
 * The instance has to be in the player's hand, and the targets have to make
 * sense for the item. Both are refused with a code rather than dropped: an item
 * that vanishes without a word is indistinguishable from a lost frame.
 */
export function useItem(
  state: RoomState,
  from: string,
  instanceId: string,
  targets: readonly string[],
  marked: readonly number[],
  elapsedSeconds: number,
): Outcome {
  const round = state.round;
  const caster = playerIn(state, from);
  if (round === null || caster === undefined) return refuseUnknown(state, from);

  const held = caster.hand.find((item) => item.instanceId === instanceId);
  if (held === undefined) {
    return refuse(state, from, 'item_not_held', 'you do not hold that item');
  }

  const check = validateTargets(held.itemId, from, targets);
  if (!check.ok) return refuse(state, from, check.code, 'those targets make no sense');

  // Spent whatever happens next: an item that fails to land is still gone, as it
  // is today, and a retry would let one instance fire twice.
  const spent: PlayerState = {
    ...caster,
    hand: caster.hand.filter((item) => item.instanceId !== instanceId),
  };
  let next = replacePlayer(state, spent);
  const effects: RoomEffect[] = [];

  if (held.itemId === 'SCANNER') {
    // C1.6 — resolved on the caster, by the server: the client does not know
    // the solution and cannot pick.
    const falsified = round.solution.map((position) => position.paragraphIndex);
    const result = scan(falsified, spent.items, marked);
    next = replacePlayer(next, { ...spent, items: result.state });
    effects.push({
      kind: 'send',
      to: from,
      message: { type: 'scanner_result', paragraphIndex: result.paragraphIndex },
    });
  }

  for (const target of targets) {
    const victim = playerIn(next, target);
    if (victim === undefined) continue;
    next = replacePlayer(next, {
      ...victim,
      items: applyItemToTarget(held.itemId, victim.items, elapsedSeconds),
    });
    effects.push({
      kind: 'send',
      to: target,
      message: { type: 'item_effect', itemId: held.itemId, from },
    });
  }

  effects.push({
    kind: 'broadcast',
    message: {
      type: 'item_used',
      player: from,
      itemId: held.itemId as ItemId,
      targets: [...targets],
    },
  });

  return { state: next, effects };
}

/**
 * The sender's optimistic score, relayed to the room.
 *
 * Deliberately optimistic — it counts every mark as correct — so an opponent's
 * score cannot be read as a hint about the solution. D6's missing throttle is
 * transport, and belongs to phase 5.
 */
export function liveScore(state: RoomState, from: string, score: number): Outcome {
  return emit<RoomState, RoomEffect>(state, {
    kind: 'broadcast',
    message: { type: 'live_score_update', player: from, score },
  });
}

/** C5.5 — the cursor, to everyone but its owner: they already know where it is. */
export function cursor(state: RoomState, from: string, x: number, y: number): Outcome {
  return {
    state,
    effects: state.players
      .filter((player) => player.name !== from)
      .map((player) => ({
        kind: 'send' as const,
        to: player.name,
        message: { type: 'cursor_update' as const, player: from, x, y },
      })),
  };
}

function refuseUnknown(state: RoomState, from: string): Outcome {
  return refuse(state, from, 'out_of_phase', 'no round is under way');
}
