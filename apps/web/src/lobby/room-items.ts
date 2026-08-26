'use client';

// D6 — the items of a room, over the socket.
//
// The state and its rules are `round/items.ts`. This is the transport, and it is
// the half that never existed: `use_item` was never sent by anything, because
// the handler the item bar was wired to was not defined.
//
// Four messages come back, and each means something different:
//   - `items_distributed` — a wave, keyed by player. Only this player's hand.
//   - `item_used` — somebody spent something. On this player, it is the
//     acknowledgement that the instance is gone.
//   - `item_effect` — something landed on this player.
//   - `scanner_result` — C1.6, and only ever sent to the caster.
import { useCallback } from 'react';

import { useRealtime, useRealtimeMessages } from '../realtime/provider.js';
import { useItems, type ItemsState } from '../round/items.js';

export interface RoomItems extends ItemsState {
  use(instanceId: string, targets: readonly string[], marked: readonly number[]): void;
}

export function useRoomItems(roundKey: string): RoomItems {
  const { me, send } = useRealtime();
  const items = useItems(roundKey);

  useRealtimeMessages((message) => {
    if (message.type === 'items_distributed') {
      // A wave is a record keyed by nickname, and it carries everybody's. Taking
      // the lot would show this player a hand they cannot spend.
      const mine = me === null ? undefined : message.items[me];
      if (mine !== undefined) items.deal([mine]);
      return;
    }

    if (message.type === 'item_used') {
      // Only this player's own spend shrinks this hand. Somebody else spending a
      // SPIN is news, not bookkeeping.
      if (message.player === me) items.spent(message.itemId);
      return;
    }

    if (message.type === 'item_effect') {
      items.hit(message.itemId, message.from);
      return;
    }

    if (message.type === 'scanner_result') {
      items.scan(message.paragraphIndex);
      return;
    }

    if (
      message.type === 'error' &&
      (message.code === 'invalid_target' || message.code === 'item_not_held')
    ) {
      items.refuse(message.code, message.message);
    }
  });

  const use = useCallback(
    (instanceId: string, targets: readonly string[], marked: readonly number[]) => {
      items.sending(instanceId);
      // C1.6 — `marked` rides along so the SCANNER does not point at a paragraph
      // the player has already ticked. The server decides; this is what it needs
      // to decide with.
      send({ type: 'use_item', instanceId, targets: [...targets], marked: [...marked] });
    },
    // `items.sending` is stable; naming the whole object would rebuild this on
    // every message that arrives.
    [items.sending, send],
  );

  return { ...items, use };
}
