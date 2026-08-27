// Which rooms this instance is listening to, and for how long.
//
// Since 5.3 nothing is written straight to a socket: an effect is published on
// the room's channel, and whichever instances hold sockets for that room deliver
// it. That makes "am I subscribed to this room" a piece of bookkeeping with a
// lifetime of its own — one that has nothing to do with the rules, the store or
// the alarms, and every reason to be readable on its own.
import type { Bus, Unsubscribe } from './bus.js';
import type { Registry } from './connections.js';
import { channelFor, deliverLocally, readEnvelope } from './effects.js';

export interface SubscriptionOptions {
  readonly bus: Bus;
  readonly namespace: string;
  readonly connections: Registry;
  /** How much a socket may have queued before it is cut. Lowered by the tests. */
  readonly budgetBytes?: number;
}

export interface Subscriptions {
  /** One more socket wants this room. Subscribes if it is the first. */
  listen(roomCode: string): Promise<void>;
  /** One fewer. Unsubscribes when it was the last. */
  stopListening(roomCode: string): Promise<void>;
  /** Drops every subscription, whatever the counts say. For shutdown. */
  closeAll(): Promise<void>;
}

/**
 * One subscription per room, however many sockets this instance holds for it.
 *
 * Counted rather than reference-free: subscribing twice would deliver twice, and
 * unsubscribing when the first of two players leaves would make the second deaf.
 * The count is of local sockets, so it says nothing about the room — another
 * instance may still be serving it.
 */
export function createSubscriptions(options: SubscriptionOptions): Subscriptions {
  const held = new Map<string, { readonly stop: Unsubscribe; holders: number }>();

  const budget =
    options.budgetBytes === undefined ? {} : { budgetBytes: options.budgetBytes };

  return {
    async listen(roomCode) {
      const already = held.get(roomCode);
      if (already !== undefined) {
        already.holders += 1;
        return;
      }

      // Claimed before the await, so two sockets arriving together do not both
      // open a subscription.
      const placeholder = { stop: async (): Promise<void> => undefined, holders: 1 };
      held.set(roomCode, placeholder);

      const stop = await options.bus.subscribe(
        channelFor(options.namespace, roomCode),
        (payload) => {
          const envelope = readEnvelope(payload);
          // Only this service publishes here, so an envelope that does not parse
          // is a bug rather than an attack — and delivering `undefined` to every
          // socket in the room would be a worse way to find out.
          if (envelope !== null) {
            deliverLocally(
              { connections: options.connections, ...budget },
              roomCode,
              envelope,
            );
          }
        },
      );

      held.set(roomCode, { stop, holders: placeholder.holders });
    },

    async stopListening(roomCode) {
      const already = held.get(roomCode);
      if (already === undefined) return;

      already.holders -= 1;
      if (already.holders > 0) return;

      held.delete(roomCode);
      await already.stop();
    },

    async closeAll() {
      for (const [, one] of held) await one.stop();
      held.clear();
    },
  };
}
