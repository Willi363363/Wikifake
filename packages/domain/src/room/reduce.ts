// The room reducer: one entry point, routing by phase.
//
// `(state, event) → {state, effects}` and nothing else. No socket, no clock, no
// Redis: phase 5 carries out the effects, and the rules never learn how.
import { settle, type Reduced } from '../reducer.js';
import { cursor, liveScore, unlockHint, useItem } from './actions.js';
import type { RoomEffect, RoomEvent } from './events.js';
import { reduceLobby } from './lobby.js';
import {
  articleFailed,
  grantItems,
  leaveDuringRound,
  startRound,
  submitAnswer,
  timerExpired,
  unsubmitAnswer,
} from './round.js';
import { playerIn, type RoomState } from './state.js';

type Outcome = Reduced<RoomState, RoomEffect>;

export function reduceRoom(state: RoomState, event: RoomEvent): Outcome {
  switch (event.kind) {
    case 'article_ready':
      // D3 — the one way into a round. Refused anywhere else, so a late article
      // from an abandoned generation cannot restart a round that already ended.
      return state.phase === 'generating'
        ? startRound(state, event.article, event.solution)
        : settle(state);

    case 'article_failed':
      return state.phase === 'generating' ? articleFailed(state) : settle(state);

    case 'timer_expired':
      return timerExpired(state);

    case 'items_granted':
      return state.phase === 'round'
        ? grantItems(state, event.wave, event.grants)
        : settle(state);

    case 'leave':
      // D5 — a dropped socket is not a departure, in a round or out of it: the
      // player stays, marked disconnected, and keeps what they have earned.
      // Ending the round on it would be ending it on a network hiccup, which is
      // what the round-end timer is for instead.
      return reduceLobby(state, event);

    case 'evict':
      // D4 — being removed mid-round can end it, which the lobby has no way to
      // know: the last player who had not submitted is gone for good.
      return state.phase === 'round'
        ? leaveDuringRound(state, event.player)
        : reduceLobby(state, event);

    case 'join':
      return reduceLobby(state, event);

    case 'message':
      break;
  }

  const { from, message } = event;
  const elapsed = event.elapsedSeconds ?? 0;

  if (state.phase !== 'round' || playerIn(state, from) === undefined) {
    return reduceLobby(state, event);
  }

  switch (message.type) {
    case 'submit_answer':
      return submitAnswer(state, from, message.marked, elapsed);
    case 'unsubmit_answer':
      return unsubmitAnswer(state, from);
    case 'unlock_hint':
      return unlockHint(state, from, message.falseInfoNumber, message.level, elapsed);
    case 'use_item':
      return useItem(
        state,
        from,
        message.instanceId,
        message.targets,
        message.marked,
        elapsed,
      );
    case 'live_score':
      return liveScore(state, from, message.score);
    case 'cursor':
      return cursor(state, from, message.x, message.y);
    // Lobby messages during a round: refused there, with a code, rather than
    // handled twice.
    case 'set_ready':
    case 'get_lobby':
    case 'force_start':
    case 'submit_theme':
    case 'force_pick':
    case 'start_game':
    case 'chat_message':
      return reduceLobby(state, event);
  }
}
