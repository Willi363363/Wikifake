'use client';

// D6 — the items a player holds, and what has been thrown at them.
//
// A rebuild rather than a port. The current chain has no entry point:
// `GameSession.jsx:376` passes `onUse={useItem}` where `useItem` is neither
// imported nor defined — a `ReferenceError` on rendering any round with items —
// and nothing ever calls `setItemModal`, so "click an item, choose a target,
// send" was never wired at either end.
//
// The state here is what the server has said: the hand comes from
// `items_distributed`, it shrinks on `item_used`, and what landed on this player
// comes from `item_effect`. Nothing is decided locally except which instance is
// currently in flight, and that exists so a refusal can be attributed to the
// item that caused it.
import type { ItemId, ItemInstance } from '@wikifake/protocol';
import { useCallback, useEffect, useState } from 'react';

/** An item that landed on this player, and who threw it. */
export interface Landed {
  /** Local, for the list key and the dismissal. */
  readonly id: string;
  readonly itemId: ItemId;
  readonly from: string;
}

/** C1.6 — what the SCANNER answered. */
export interface ScanNotice {
  readonly id: string;
  /** Null once every falsification has already been pointed at. */
  readonly paragraphIndex: number | null;
}

export interface ItemsState {
  readonly hand: readonly ItemInstance[];
  /** The instance whose `use_item` is in flight, or null. */
  readonly pending: string | null;
  /** What has landed on this player and has not been dismissed. */
  readonly landed: readonly Landed[];
  /** C1.6 — paragraphs a SCANNER has pointed this player at. */
  readonly scanned: ReadonlySet<number>;
  readonly lastScan: ScanNotice | null;
  /** What the server refused, or null. */
  readonly refusal: string | null;

  /** A wave arrived. */
  deal(items: readonly ItemInstance[]): void;
  /** This client is sending `use_item` for this instance. */
  sending(instanceId: string): void;
  /** The server announced this player spent an item of this kind. */
  spent(itemId: ItemId): void;
  /** An item landed on this player. */
  hit(itemId: ItemId, from: string): void;
  scan(paragraphIndex: number | null): void;
  /**
   * The server refused the use in flight.
   *
   * `item_not_held` means the hand this client is showing is stale, so the
   * instance goes; `invalid_target` means the targets were wrong and the item was
   * never spent, so it stays and can be thrown again.
   */
  refuse(code: 'invalid_target' | 'item_not_held', message: string): void;
  dismiss(id: string): void;
  clearRefusal(): void;
}

/** Local ids for things that arrive without one. Monotonic, not random. */
let counter = 0;
const nextId = (): string => {
  counter += 1;
  return `landed-${String(counter)}`;
};

export function useItems(roundKey: string): ItemsState {
  const [hand, setHand] = useState<readonly ItemInstance[]>([]);
  const [pending, setPending] = useState<string | null>(null);
  const [landed, setLanded] = useState<readonly Landed[]>([]);
  const [scanned, setScanned] = useState<ReadonlySet<number>>(new Set());
  const [lastScan, setLastScan] = useState<ScanNotice | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);

  useEffect(() => {
    setHand([]);
    setPending(null);
    setLanded([]);
    setScanned(new Set());
    setLastScan(null);
    setRefusal(null);
  }, [roundKey]);

  const deal = useCallback((items: readonly ItemInstance[]) => {
    // Appended, not replaced: a wave is what was added, and the hand is what has
    // not been spent. Deduplicated by instance, because a frame delivered twice
    // must not double a hand.
    setHand((was) => {
      const held = new Set(was.map((item) => item.instanceId));
      return [...was, ...items.filter((item) => !held.has(item.instanceId))];
    });
  }, []);

  const sending = useCallback((instanceId: string) => {
    setPending(instanceId);
    setRefusal(null);
  }, []);

  const spent = useCallback((itemId: ItemId) => {
    // `item_used` names the kind, not the instance. One use is allowed in flight
    // at a time, so the instance to drop is the one that was sent — and failing
    // that, the first of that kind.
    setHand((was) => {
      setPending(null);
      const at = was.findIndex((item) => item.itemId === itemId);
      return at === -1 ? was : [...was.slice(0, at), ...was.slice(at + 1)];
    });
  }, []);

  const hit = useCallback((itemId: ItemId, from: string) => {
    setLanded((was) => [...was, { id: nextId(), itemId, from }]);
  }, []);

  const scan = useCallback((paragraphIndex: number | null) => {
    setPending(null);
    setLastScan({ id: nextId(), paragraphIndex });
    if (paragraphIndex !== null) {
      setScanned((was) => new Set([...was, paragraphIndex]));
    }
  }, []);

  const refuse = useCallback(
    (code: 'invalid_target' | 'item_not_held', message: string) => {
      setRefusal(message);
      setPending((was) => {
        if (was !== null && code === 'item_not_held') {
          setHand((held) => held.filter((item) => item.instanceId !== was));
        }
        return null;
      });
    },
    [],
  );

  const dismiss = useCallback((id: string) => {
    setLanded((was) => was.filter((each) => each.id !== id));
  }, []);

  const clearRefusal = useCallback(() => {
    setRefusal(null);
  }, []);

  return {
    hand,
    pending,
    landed,
    scanned,
    lastScan,
    refusal,
    deal,
    sending,
    spent,
    hit,
    scan,
    refuse,
    dismiss,
    clearRefusal,
  };
}
