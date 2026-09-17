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
  /**
   * The subscription each room is holding, as a **promise** — step Q.4.
   *
   * It used to be the resolved `Unsubscribe`, with a no-op placeholder written
   * into the map before the await so that two sockets arriving together did
   * not both subscribe. That defence is right and the placeholder was the
   * wrong shape for it: a `bus.subscribe` that **rejected** left the
   * placeholder behind, and every later `listen` for that room found it,
   * incremented `holders` and subscribed nothing. The instance went deaf for
   * that room — no roster, no chat, no start — for the life of the process,
   * whether or not Redis came back. The listener's own reconnection does not
   * help: it restores the channels the driver holds, and this one was never
   * subscribed.
   *
   * Holding the promise keeps the defence and loses the trap. Concurrent
   * callers await the same attempt, so they all subscribe once; when that
   * attempt fails they all fail together, the entry is removed, and the next
   * socket to arrive tries again.
   */
  const held = new Map<
    string,
    { readonly stop: Promise<Unsubscribe>; holders: number }
  >();

  const budget =
    options.budgetBytes === undefined ? {} : { budgetBytes: options.budgetBytes };

  return {
    async listen(roomCode) {
      const already = held.get(roomCode);
      if (already !== undefined) {
        already.holders += 1;
        // Awaited, so a caller that arrived during a failing attempt hears
        // about the failure rather than believing it is listening.
        await already.stop;
        return;
      }

      // Claimed before the await, so two sockets arriving together do not both
      // open a subscription — and claimed as the *attempt*, so a failure is
      // something the next caller can retry past.
      const attempt = options.bus.subscribe(
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
      held.set(roomCode, { stop: attempt, holders: 1 });

      try {
        await attempt;
      } catch (error) {
        // Only if it is still ours: a later `listen` may already have replaced
        // a failed attempt, and dropping that one would strand its channel.
        if (held.get(roomCode)?.stop === attempt) held.delete(roomCode);
        throw error;
      }
    },

    async stopListening(roomCode) {
      const already = held.get(roomCode);
      if (already === undefined) return;

      already.holders -= 1;
      if (already.holders > 0) return;

      held.delete(roomCode);
      // A subscription that never opened has nothing to undo, and its failure
      // has already been reported to whoever asked for it.
      await already.stop.then(async (stop) => stop()).catch(() => undefined);
    },

    async closeAll() {
      for (const [, one] of held)
        await one.stop.then(async (stop) => stop()).catch(() => undefined);
      held.clear();
    },
  };
}
