'use client';

// What the room looks like, according to the server.
//
// Every field below arrives in a `lobby_update` and none of it is worked out
// here. That is not fastidiousness: the current `PlayerList` decides who the
// host is with `i === 0`, which is the server's rule reimplemented in a
// component — it happens to agree today, and it is the kind of agreement that
// ends silently the first time the roster is sorted for display.
import type { OutgoingMessage } from '@wikifake/protocol';
import { useCallback, useState } from 'react';

import { useRealtimeMessages } from '../realtime/provider.js';
import type { ArticleFacts } from '../round/article.js';

/** One player, exactly as `lobby_update` carries them. */
export interface RoomPlayer {
  readonly name: string;
  readonly colour: string;
  /** D5 — false while their socket is down and their seat is being kept. */
  readonly connected: boolean;
  readonly ready: boolean;
  readonly answered: boolean;
  readonly isHost: boolean;
}

/**
 * Where the room is, as far as this client has been told.
 *
 * Worked out from the messages that arrive, because nothing carries it: neither
 * `lobby_update` nor the answer to `get_lobby` says what phase a room is in.
 * That is a gap rather than a design — see the note in
 * `phase-07-steps-room.md` — and it is why a player who reconnects mid-vote
 * sees a lobby until the next message happens to arrive.
 */
export type RoomPhase = 'lobby' | 'voting' | 'generating' | 'round';

/** The vote, as the server reports it. Never as this client counts it. */
export interface VoteView {
  /** Who has voted. C1.7 — the server's list, not a local flag. */
  readonly submitted: readonly string[];
  readonly total: number;
}

/** The topic the server elected, and who proposed it. */
export interface ElectedTopic {
  readonly topic: string;
  /** Null when no ballot decided it and a fallback was used. */
  readonly proposer: string | null;
}

/** The round the server started, as the screen needs it. */
export interface RoundView {
  readonly article: ArticleFacts;
  readonly timeLimit: number;
}

export interface RoomView {
  readonly phase: RoomPhase;
  readonly vote: VoteView;
  readonly elected: ElectedTopic | null;
  /**
   * The round in progress, or null outside one.
   *
   * Exactly what `game_start` carries: the paragraphs, the topic, the source,
   * the **number** of falsifications, and how long the round lasts. C1.1 —
   * nothing here says which paragraphs, because the message has no field that
   * could.
   *
   * The time limit comes from here rather than from the host settings, and that
   * closes half of the gap this file's header describes: those settings live in
   * the host's browser, so a guest reading them would count down from the
   * default while the round ran on something else.
   */
  readonly round: RoundView | null;
  /** Whether *this* player has voted, according to the server. */
  readonly hasVoted: boolean;
  readonly players: readonly RoomPlayer[];
  /** The player this browser is, or null before the first roster arrives. */
  readonly me: RoomPlayer | null;
  readonly isHost: boolean;
  readonly isReady: boolean;
  /** The last refusal the server sent, and its code. Cleared by the caller. */
  readonly refusal: { readonly code: string; readonly message: string } | null;
  clearRefusal(): void;
}

type Lobby = Extract<OutgoingMessage, { type: 'lobby_update' }>;

const NO_VOTE: VoteView = { submitted: [], total: 0 };

/**
 * Refusals another hook owns, and therefore displays.
 *
 * `hints_blocked` is the intel panel's — it means nothing was charged and the
 * lock lifts, which is a state and not a sentence. `invalid_target` and
 * `item_not_held` are the item bar's, and the second decides whether a card
 * stays in the hand. Shown here as well, they would appear twice on the same
 * screen, in two places, saying the same thing.
 *
 * Explicit rather than clever: a code added to the contract and forgotten here
 * shows up as a refusal in the ordinary place, which is the safe direction.
 */
const OWNED_ELSEWHERE: readonly string[] = [
  'hints_blocked',
  'invalid_target',
  'item_not_held',
];

export function useRoom(nickname: string | null): RoomView {
  const [players, setPlayers] = useState<readonly RoomPlayer[]>([]);
  const [refusal, setRefusal] = useState<RoomView['refusal']>(null);
  const [phase, setPhase] = useState<RoomPhase>('lobby');
  const [vote, setVote] = useState<VoteView>(NO_VOTE);
  const [elected, setElected] = useState<ElectedTopic | null>(null);
  const [round, setRound] = useState<RoundView | null>(null);

  useRealtimeMessages((message) => {
    if (message.type === 'lobby_update') {
      setPlayers((message as Lobby).players);
      return;
    }

    if (message.type === 'theme_vote_start') {
      setPhase('voting');
      setVote(NO_VOTE);
      setElected(null);
      return;
    }

    if (message.type === 'theme_vote_update') {
      setVote({ submitted: message.submitted, total: message.total });
      return;
    }

    // The criterion: the topic on screen is this message's, never a tally.
    if (message.type === 'theme_selected') {
      setPhase('generating');
      setElected({ topic: message.topic, proposer: message.proposer });
      return;
    }

    if (message.type === 'game_start') {
      setPhase('round');
      setRound({
        article: {
          topic: message.topic,
          paragraphs: message.paragraphs,
          totalFakes: message.totalFakes,
          wikipediaUrl: message.wikipediaUrl,
        },
        timeLimit: message.timeLimit,
      });
      return;
    }

    // C1.2 — the round is over and the room is a lobby again. `ready` is
    // cleared server-side, and the roster that follows says so.
    if (message.type === 'game_end') {
      setPhase('lobby');
      setElected(null);
      // The debrief is phase 8.7, and until it exists the article goes with the
      // round rather than lingering under a lobby.
      setRound(null);
      return;
    }
    // C1.7 — a refusal is the server telling this client it was wrong about
    // something. It is shown, and it changes nothing else: the roster that
    // arrives next is the truth, and it will arrive whether or not this client
    // agrees with it.
    if (message.type === 'error') {
      if (OWNED_ELSEWHERE.includes(message.code)) return;
      setRefusal({ code: message.code, message: message.message });
      // C3.7 — every candidate failed and the server put the room back in the
      // lobby. Without this the screen waits for an article that is not coming,
      // which is the state the current server leaves it in.
      if (message.code === 'generation_failed') {
        setPhase('lobby');
        setElected(null);
        setRound(null);
      }
    }
  });

  const me = players.find((player) => player.name === nickname) ?? null;

  return {
    players,
    me,
    phase,
    vote,
    elected,
    round,
    // Not "I pressed submit". The current screen sets a local flag the moment
    // the form is sent, so a ballot the server refused — out of phase, or on a
    // socket that was already down — still reads as submitted and never counts.
    hasVoted: nickname !== null && vote.submitted.includes(nickname),
    isHost: me?.isHost ?? false,
    isReady: me?.ready ?? false,
    refusal,
    clearRefusal: useCallback(() => {
      setRefusal(null);
    }, []),
  };
}
