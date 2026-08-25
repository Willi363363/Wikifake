// The room, as two atomic scripts — and no rules in either.
//
// This is the phase's first pitfall, written as code: "the reducer decides, the
// script applies. A business `if` in a Lua script is a sign of drift." So there
// is exactly one `if` below, and it compares two integers.
//
// What the scripts buy is the thing a sequence of commands cannot: a room whose
// state is read, decided on and written back by two instances at once must not
// lose one of the two decisions. The compare-and-set below is what makes the
// loser notice — it is told the revision moved, and it decides again against the
// state that won. The current server holds a single process's dictionary and
// never had the problem, which is also why it can only ever be one process.
//
// Cluster note: one key per room, so every script touches one slot. Nothing here
// would need revisiting if Redis were sharded.

/**
 * Swaps the state if nobody else did first.
 *
 * `KEYS[1]` the room's hash. `ARGV[1]` the revision the caller decided against,
 * `ARGV[2]` the state it decided on, `ARGV[3]` how long a silent room lives, in
 * milliseconds.
 *
 * Returns `{1, newRevision}` when it committed, `{0, currentRevision}` when
 * somebody else got there first. The current revision comes back with the
 * refusal so the caller can retry without a second round trip.
 *
 * The TTL is refreshed on every commit, which is the idle-room expiry of D4
 * expressed as a fact about the data rather than as a job that has to run. The
 * job of step 5.4 announces the closure; this makes sure the state is gone even
 * if it never runs.
 */
export const SWAP_SCRIPT = `
local held = redis.call('HGET', KEYS[1], 'revision')
if held == false then held = '0' end

if held ~= ARGV[1] then
  return {0, held}
end

local next = tonumber(held) + 1
redis.call('HSET', KEYS[1], 'revision', next, 'state', ARGV[2])
redis.call('PEXPIRE', KEYS[1], ARGV[3])
return {1, tostring(next)}
`;

/**
 * Forgets the room, if it is still the one the caller was looking at.
 *
 * C1.8 — the last player left. Guarded by the same revision, because "the room
 * is empty" is a decision taken against a state, and somebody may have joined
 * between the decision and the delete. Deleting unconditionally would drop a
 * player into a room that no longer exists.
 */
export const CLOSE_SCRIPT = `
local held = redis.call('HGET', KEYS[1], 'revision')
if held == false then held = '0' end

if held ~= ARGV[1] then
  return {0, held}
end

redis.call('DEL', KEYS[1])
return {1, '0'}
`;
