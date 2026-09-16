// The room's state, held by Redis and decided by the reducer.
//
// The step's rule, and the reason the phase is shaped this way: **no instance
// holds the truth**. Nothing below keeps a room between calls — not a cache, not
// a `Map`, not a memoised anything. Every event reads the state, hands it to
// `reduceRoom`, and writes back what came out.
//
// The write is a compare-and-set. Two instances deciding on the same room at the
// same moment both read revision 7; one commits 8, the other is told 7 is gone
// and decides again against 8. That is what "two concurrent transitions are not
// lost" means, and it is the property a read-modify-write without the compare
// silently fails to have.
import {
  emptyRoom,
  reduceRoom,
  type RoomEffect,
  type RoomEvent,
  type RoomState,
} from '@wikifake/domain';
import { ROOM_IDLE_LIMIT_SECONDS } from '@wikifake/domain';

import { CLOSE_SCRIPT, SWAP_SCRIPT, TOUCH_SCRIPT } from './scripts.js';
import type { RedisCommands } from '../redis.js';

/** Keys are namespaced so two deployments on one Redis do not share rooms. */
export const NAMESPACE = 'wikifake:room';

export function roomKey(namespace: string, code: string): string {
  return `${namespace}:${code}`;
}

/**
 * How many times a losing writer decides again before giving up.
 *
 * Contention on one room is bounded by how many players it holds, and a retry is
 * a read plus a pure function. Ten is far past anything a room can produce; what
 * it protects against is a livelock nobody would otherwise notice.
 */
const ATTEMPTS = 10;

export interface StoreOptions {
  readonly redis: RedisCommands;
  readonly namespace?: string;
  /** How long a room with no activity survives. D4, as a fact about the data. */
  readonly idleSeconds?: number;
}

/** A room as it stands, and the revision that state was written at. */
export interface Held {
  readonly state: RoomState;
  /** `0` when the room has never been written. */
  readonly revision: number;
}

export interface Applied {
  readonly state: RoomState;
  readonly effects: readonly RoomEffect[];
  readonly revision: number;
}

export interface RoomStore {
  /** The room as Redis holds it, or an empty one at revision 0. */
  read(code: string): Promise<Held>;
  /**
   * Decides an event against the current state and commits the result.
   *
   * Retries on contention rather than failing: the caller lost a race it had no
   * way to avoid, and the answer is to decide again, not to drop a player's
   * message.
   */
  apply(code: string, event: RoomEvent): Promise<Applied>;
}

/** `{committed, revision}` — the shape both scripts return. */
function readOutcome(raw: unknown): { committed: boolean; revision: number } {
  const pair = raw as [number | string, string];
  return { committed: Number(pair[0]) === 1, revision: Number(pair[1]) };
}

/**
 * A state Redis handed back, or `null` if it is not one.
 *
 * Only this service ever writes these, so a value that does not parse is a bug
 * here rather than an attack — but a bug here would otherwise reach `reduceRoom`
 * as rubbish and produce a room whose phase is `undefined`. Refused at the door,
 * where the cause is still visible.
 */
function readState(raw: string | null): RoomState | null {
  if (raw === null) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (typeof parsed !== 'object' || parsed === null) return null;
  const candidate = parsed as Partial<RoomState>;

  return typeof candidate.phase === 'string' && Array.isArray(candidate.players)
    ? (parsed as RoomState)
    : null;
}

export function createRoomStore(options: StoreOptions): RoomStore {
  const namespace = options.namespace ?? NAMESPACE;
  const idleMs = String((options.idleSeconds ?? ROOM_IDLE_LIMIT_SECONDS) * 1000);

  async function read(code: string): Promise<Held> {
    const [revision, state] = await options.redis.hmGet(roomKey(namespace, code), [
      'revision',
      'state',
    ]);

    const held = readState(state ?? null);
    // An absent room and an unreadable one are the same thing to a caller: there
    // is no state to decide against, so the next event starts from an empty one.
    return held === null
      ? { state: emptyRoom(), revision: 0 }
      : { state: held, revision: Number(revision ?? 0) };
  }

  return {
    read,

    async apply(code, event) {
      const key = roomKey(namespace, code);

      for (let attempt = 0; attempt < ATTEMPTS; attempt += 1) {
        const held = await read(code);
        const decided = reduceRoom(held.state, event);

        // C1.8 — the room is over. Deleted under the same revision guard, so a
        // player who joined between the decision and the delete does not land in
        // a room that is being forgotten.
        const closing = decided.effects.some((effect) => effect.kind === 'close_room');

        // Step O.5 — an event that changed nothing writes nothing.
        //
        // `cursor`, `live_score`, `chat_message`, `get_lobby` and every refusal
        // hand back the state they were given: `emit(state, …)` keeps the
        // reference, so the reducer says so itself and nothing here has to
        // compare two object graphs to find out.
        //
        // Writing them anyway was not free and not harmless. A room in a round
        // holds the whole article and the whole solution — **20.3 KiB
        // measured** — and `cursor` alone rewrote all of it sixteen times a
        // second per player, read and written, changing nothing. Worse than the
        // bytes: each one took the revision, so a `submit_answer` or a
        // `use_item` racing four moving mice lost the compare-and-swap it had no
        // reason to lose, and ten of those became "the room could not be
        // reached" said to somebody looking at the room.
        //
        // The TTL still has to be refreshed, because the swap used to do it as a
        // side effect of committing — a room whose only traffic is cursors and
        // chat must not expire underneath the players making it. That is one
        // `PEXPIRE` against a whole state.
        const unchanged = decided.state === held.state && !closing;

        const outcome = readOutcome(
          await options.redis.eval(
            closing ? CLOSE_SCRIPT : unchanged ? TOUCH_SCRIPT : SWAP_SCRIPT,
            {
              keys: [key],
              arguments: closing
                ? [String(held.revision)]
                : unchanged
                  ? [String(held.revision), idleMs]
                  : [String(held.revision), JSON.stringify(decided.state), idleMs],
            },
          ),
        );

        if (outcome.committed) {
          return {
            state: decided.state,
            effects: decided.effects,
            revision: outcome.revision,
          };
        }
        // Somebody else committed first. Their state is the one that counts, and
        // the loop reads it back rather than trusting the revision it was told.
      }

      throw new Error(
        `room ${code}: ${String(ATTEMPTS)} attempts lost the race — Redis is contended or a writer is looping`,
      );
    },
  };
}
