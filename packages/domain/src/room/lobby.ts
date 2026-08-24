// The lobby transitions: arriving, leaving, getting ready, voting on a topic,
// and who is allowed to start.
//
// Every guard answers. The current handlers return early when a message arrives
// in the wrong phase, so the client is told nothing and waits for a reply that
// never comes; here an out-of-phase message is refused with a code, which is
// what step 1.8 means by "rejected explicitly, not silently ignored".
import type { IncomingMessage, OutgoingMessage, ErrorCode } from '@wikifake/protocol';

import { emit, settle, type Reduced } from '../reducer.js';
import type { RoomEffect, RoomEvent } from './events.js';
import { FALLBACK_TOPICS, selectTopic } from './topics.js';
import {
  assignColour,
  hostOf,
  isHost,
  newPlayer,
  playerIn,
  type RoomState,
} from './state.js';

type Outcome = Reduced<RoomState, RoomEffect>;

/**
 * What the lobby knows how to answer. The round events reach `reduceRoom`, which
 * routes them to `round.ts` — so an event the lobby cannot handle is a type
 * error rather than a silent no-op.
 */
export type LobbyEvent = Extract<
  RoomEvent,
  { kind: 'join' } | { kind: 'leave' } | { kind: 'message' }
>;

/** The roster, as the protocol carries it. */
export function lobbyUpdate(state: RoomState): OutgoingMessage {
  const host = hostOf(state);
  return {
    type: 'lobby_update',
    players: state.players.map((player) => ({
      name: player.name,
      colour: player.colour,
      ready: player.ready,
      answered: player.answered,
      isHost: player.name === host,
    })),
  };
}

/** A refusal: the state is untouched, and the sender is told why. */
function refuse(state: RoomState, to: string, code: ErrorCode, message: string): Outcome {
  return emit(state, { kind: 'send', to, message: { type: 'error', code, message } });
}

function announce(state: RoomState): Outcome {
  return emit(state, { kind: 'broadcast', message: lobbyUpdate(state) });
}

function join(state: RoomState, name: string): Outcome {
  // C5.2 — a connected duplicate is refused without touching the player already
  // in place. Their socket, their score and their paid hints stay theirs.
  if (playerIn(state, name) !== undefined) {
    return refuse(state, name, 'name_taken', `the nickname ${name} is already in use`);
  }

  const next: RoomState = {
    ...state,
    players: [...state.players, newPlayer(name, assignColour(state))],
  };
  return announce(next);
}

function leave(state: RoomState, name: string): Outcome {
  const players = state.players.filter((player) => player.name !== name);
  if (players.length === state.players.length) return settle(state);

  // C1.8 — the room disappears with its last player. Everything attached goes
  // with it, which is what the current cleanup forgets when an unexpected
  // exception skips it.
  if (players.length === 0) {
    return emit({ ...state, players }, { kind: 'close_room' });
  }

  // C1.8 — promotion needs no transition: the host is whoever is first, so
  // removing them promotes the next by arithmetic.
  return announce({ ...state, players });
}

function setReady(state: RoomState, from: string, message: IncomingMessage): Outcome {
  if (message.type !== 'set_ready') return settle(state);
  if (state.phase !== 'lobby' && state.phase !== 'voting') {
    return refuse(state, from, 'out_of_phase', 'a round is under way');
  }

  const players = state.players.map((player) =>
    player.name === from ? { ...player, ready: message.ready } : player,
  );

  // C1.7 — the options belong to the host, and only in the lobby. A guest's
  // `set_ready` carries them too (the client attaches them every time), so they
  // are dropped rather than refused: answering an error to every guest's ready
  // would be noise, and their own `ready` is legitimate.
  //
  // D6 — accepting a `timeLimit` once a round is under way changed the time
  // bonus of every later submission. Out of the lobby, there is nothing to
  // change.
  const options =
    isHost(state, from) && state.phase === 'lobby'
      ? {
          withItems: message.withItems ?? state.options.withItems,
          timeLimit: message.timeLimit ?? state.options.timeLimit,
        }
      : state.options;

  return announce({ ...state, players, options });
}

function forceStart(state: RoomState, from: string, message: IncomingMessage): Outcome {
  if (message.type !== 'force_start') return settle(state);
  if (state.phase !== 'lobby') {
    return refuse(state, from, 'out_of_phase', 'the vote is already open');
  }
  // C1.7 — refused to a guest **without changing the state**: not the options,
  // not the phase. The current handler applies the options before checking.
  if (!isHost(state, from)) {
    return refuse(state, from, 'not_host', 'only the host can open the vote');
  }

  const next: RoomState = {
    ...state,
    phase: 'voting',
    ballots: {},
    options: {
      withItems: message.withItems ?? state.options.withItems,
      timeLimit: message.timeLimit ?? state.options.timeLimit,
    },
  };
  return emit(next, { kind: 'broadcast', message: { type: 'theme_vote_start' } });
}

function submitTheme(
  state: RoomState,
  from: string,
  message: IncomingMessage,
  seed: number,
): Outcome {
  if (message.type !== 'submit_theme') return settle(state);
  if (state.phase !== 'voting') {
    return refuse(state, from, 'out_of_phase', 'no vote is open');
  }

  const ballots = { ...state.ballots, [from]: message.topic };
  const voted = Object.keys(ballots).length;
  const withBallot: RoomState = { ...state, ballots };

  const update: RoomEffect = {
    kind: 'broadcast',
    message: {
      type: 'theme_vote_update',
      submitted: Object.keys(ballots),
      total: state.players.length,
    },
  };

  if (voted < state.players.length) return emit(withBallot, update);

  const picked = selectTopic(withBallot, seed);
  return { state: picked.state, effects: [update, ...picked.effects] };
}

function forcePick(
  state: RoomState,
  from: string,
  message: IncomingMessage,
  seed: number,
): Outcome {
  if (message.type !== 'force_pick') return settle(state);
  if (state.phase !== 'voting') {
    return refuse(state, from, 'out_of_phase', 'no vote is open');
  }
  if (!isHost(state, from)) {
    return refuse(state, from, 'not_host', 'only the host can close the vote');
  }
  if (Object.keys(state.ballots).length === 0) {
    return refuse(state, from, 'no_theme_submitted', 'nobody has proposed a topic yet');
  }
  return selectTopic(state, seed);
}

function startGame(state: RoomState, from: string, message: IncomingMessage): Outcome {
  if (message.type !== 'start_game') return settle(state);
  if (state.phase !== 'lobby') {
    return refuse(state, from, 'out_of_phase', 'a round is already starting');
  }
  if (!isHost(state, from)) {
    return refuse(state, from, 'not_host', 'only the host can start a round');
  }

  const next: RoomState = {
    ...state,
    phase: 'generating',
    ballots: {},
    options: {
      withItems: message.withItems ?? state.options.withItems,
      timeLimit: message.timeLimit ?? state.options.timeLimit,
    },
    generating: {
      topic: message.topic,
      proposer: from,
      remaining: FALLBACK_TOPICS.filter((fallback) => fallback !== message.topic),
    },
  };
  return emit(next, { kind: 'generate_article', topic: message.topic });
}

/**
 * The lobby reducer.
 *
 * Round messages are refused here with `out_of_phase`: the `round` phase is
 * unreachable until step 1.9 introduces the article that starts it.
 */
export function reduceLobby(state: RoomState, event: LobbyEvent): Outcome {
  switch (event.kind) {
    case 'join':
      return join(state, event.player);
    case 'leave':
      return leave(state, event.player);
    case 'message':
      break;
  }

  const { from, message } = event;
  const seed = event.seed ?? 0;

  // A player who is not in the room cannot act in it. The current handlers index
  // `room.players[player_name]` directly and raise a `KeyError` on a message
  // that arrives just after a departure.
  if (playerIn(state, from) === undefined) {
    return refuse(state, from, 'room_not_found', 'you are not in this room');
  }

  switch (message.type) {
    case 'set_ready':
      return setReady(state, from, message);
    case 'get_lobby':
      return announce(state);
    case 'force_start':
      return forceStart(state, from, message);
    case 'submit_theme':
      return submitTheme(state, from, message, seed);
    case 'force_pick':
      return forcePick(state, from, message, seed);
    case 'start_game':
      return startGame(state, from, message);
    case 'chat_message':
      // C5.4 — the chat works in every phase, as it does today.
      return emit(state, {
        kind: 'broadcast',
        message: { type: 'chat_message', sender: from, content: message.content },
      });
    case 'live_score':
    case 'cursor':
    case 'use_item':
    case 'unlock_hint':
    case 'submit_answer':
    case 'unsubmit_answer':
      return refuse(state, from, 'out_of_phase', 'no round is under way');
  }
}
