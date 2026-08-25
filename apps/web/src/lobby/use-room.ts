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

export interface RoomView {
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

export function useRoom(nickname: string | null): RoomView {
  const [players, setPlayers] = useState<readonly RoomPlayer[]>([]);
  const [refusal, setRefusal] = useState<RoomView['refusal']>(null);

  useRealtimeMessages((message) => {
    if (message.type === 'lobby_update') {
      setPlayers((message as Lobby).players);
      return;
    }
    // C1.7 — a refusal is the server telling this client it was wrong about
    // something. It is shown, and it changes nothing else: the roster that
    // arrives next is the truth, and it will arrive whether or not this client
    // agrees with it.
    if (message.type === 'error') {
      setRefusal({ code: message.code, message: message.message });
    }
  });

  const me = players.find((player) => player.name === nickname) ?? null;

  return {
    players,
    me,
    isHost: me?.isHost ?? false,
    isReady: me?.ready ?? false,
    refusal,
    clearRefusal: useCallback(() => {
      setRefusal(null);
    }, []),
  };
}
