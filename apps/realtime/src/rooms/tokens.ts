// D5 — who is allowed to reclaim a nickname.
//
// A player whose socket drops keeps their seat, their score and the hints they
// paid for until the grace window runs out. That is the fix; it is also, on its
// own, a way to steal all three by typing somebody's nickname while they are
// reconnecting. The current server has no such hole because it has no such
// feature: it deletes the player, and there is nothing left to take.
//
// So a slot is bound to a secret the **client** owns. It sends one on every
// connection, including the first; the server stores what it was given and
// compares. Nothing is minted here and no secret travels downwards, which is why
// the protocol grows no message for any of this.
import type { RedisCommands } from '../redis.js';

/**
 * Binds a nickname to a token, or checks it against the one already bound.
 *
 * One `if`, comparing two strings — the same discipline as the room's own
 * script. `KEYS[1]` the room's token hash, `ARGV[1]` the nickname, `ARGV[2]` what
 * the caller offers, `ARGV[3]` what to store if nobody holds the slot yet,
 * `ARGV[4]` how long the hash lives.
 *
 * Returns `1` when the caller may have the slot: either nobody holds it, or what
 * they offered is what its holder stored. `0` otherwise.
 *
 * Offered and stored are separate arguments for one case: a client that brings
 * no secret. It gets the slot, and what is stored for it is a value no client
 * can ever present — so the slot is unreclaimable rather than reclaimable by the
 * next person who also brings nothing.
 */
const CLAIM_SCRIPT = `
local held = redis.call('HGET', KEYS[1], ARGV[1])

if held == false then
  redis.call('HSET', KEYS[1], ARGV[1], ARGV[3])
  redis.call('PEXPIRE', KEYS[1], ARGV[4])
  return 1
end

if held ~= ARGV[2] then
  return 0
end

redis.call('PEXPIRE', KEYS[1], ARGV[4])
return 1
`;

/**
 * Stored for a slot nobody can reclaim.
 *
 * Shorter than a token can be, so no client can offer it: `sessionToken` in the
 * handshake requires at least sixteen characters.
 */
const UNRECLAIMABLE = '-';

/** Forgets one player's token. Called when the grace window has taken them. */
const FORGET_SCRIPT = `
redis.call('HDEL', KEYS[1], ARGV[1])
return 1
`;

export interface TokenStore {
  /** Whether this connection may hold that nickname in that room. */
  claim(roomCode: string, playerName: string, token: string): Promise<boolean>;
  forget(roomCode: string, playerName: string): Promise<void>;
}

export function tokensKey(namespace: string, roomCode: string): string {
  return `${namespace}:tokens:${roomCode}`;
}

export interface TokenOptions {
  readonly redis: RedisCommands;
  readonly namespace: string;
  /** The room's own idle life: a token outliving its room protects nothing. */
  readonly idleSeconds: number;
}

export function createTokenStore(options: TokenOptions): TokenStore {
  const ttlMs = String(options.idleSeconds * 1000);

  return {
    async claim(roomCode, playerName, token) {
      const granted = await options.redis.eval(CLAIM_SCRIPT, {
        keys: [tokensKey(options.namespace, roomCode)],
        arguments: [
          playerName,
          // What is offered. Empty matches nothing, because nothing empty is
          // ever stored.
          token,
          token === '' ? UNRECLAIMABLE : token,
          ttlMs,
        ],
      });
      return Number(granted) === 1;
    },

    async forget(roomCode, playerName) {
      await options.redis.eval(FORGET_SCRIPT, {
        keys: [tokensKey(options.namespace, roomCode)],
        arguments: [playerName],
      });
    },
  };
}

/**
 * A token store that never leaves the process.
 *
 * For the suites that are not about the claim itself. `reconnect.test.ts` runs
 * the real one against a Redis, which is where the rule has to hold — a claim
 * that only one instance knows about is not a claim.
 */
export function createLocalTokens(): TokenStore {
  const held = new Map<string, string>();
  const key = (roomCode: string, playerName: string): string =>
    `${roomCode}|${playerName}`;

  return {
    claim(roomCode, playerName, token) {
      const at = key(roomCode, playerName);
      const stored = held.get(at);

      if (stored === undefined) {
        held.set(at, token === '' ? UNRECLAIMABLE : token);
        return Promise.resolve(true);
      }
      return Promise.resolve(stored === token);
    },

    forget(roomCode, playerName) {
      held.delete(key(roomCode, playerName));
      return Promise.resolve();
    },
  };
}
