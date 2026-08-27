// The cache, as three atomic scripts.
//
// Why Lua rather than a sequence of commands: the reason for moving the cache to
// Redis at all is that it becomes **shared between instances**. A read that
// filters expired entries, bumps a rotation counter and touches an LRU index is
// four commands; two instances interleaving them serve the same variant twice,
// leave four variants where three are allowed, or evict a category the other one
// just wrote. The Python held a `threading.Lock` for exactly this and only had to
// defend against its own threads. A script is that lock, for every instance.
//
// Cluster note: the eviction path builds key names from a prefix passed in ARGV
// rather than declaring them in KEYS, which Redis Cluster would refuse across
// slots. This is deliberate for a single instance (Upstash, a container in CI)
// and is the one thing to revisit if the cache is ever sharded.

/**
 * An entry is `storedAt` and a newline and the JSON.
 *
 * Prefixed rather than wrapped in an object so the scripts can read the timestamp
 * with `string.find` instead of decoding JSON they have no other reason to touch.
 */
export const ENTRY_SEPARATOR = '\n';

/** Filters expired entries in place. Shared prologue of both scripts. */
const LIVE_ENTRIES = `
local function live(listKey, now, ttl)
  local entries = redis.call('LRANGE', listKey, 0, -1)
  local kept = {}
  for i = 1, #entries do
    local at = string.find(entries[i], '\\n', 1, true)
    local storedAt = at and tonumber(string.sub(entries[i], 1, at - 1))
    if storedAt and (now - storedAt) <= ttl then
      kept[#kept + 1] = entries[i]
    end
  end
  return entries, kept
end
`;

/**
 * Reads one variant, in rotation.
 *
 * KEYS: variants, turn, index. ARGV: now (ms), ttl (ms), normalised key.
 * Returns the chosen entry, or nothing when the category has none.
 *
 * C4.4 — the variant is chosen by an incrementing counter, not at random. The
 * Python calls `random.choice`, which satisfies "does not serve the same article
 * forever" only in expectation: nothing stops it returning the same variant ten
 * times running. Redis has `INCR`, so the target enforces what the contract says.
 */
export const GET_SCRIPT = `
${LIVE_ENTRIES}
local now, ttl, key = tonumber(ARGV[1]), tonumber(ARGV[2]), ARGV[3]
local entries, kept = live(KEYS[1], now, ttl)

if #kept == 0 then
  -- The category is gone, so it leaves the index too. The Python returns here
  -- *before* touching its LRU list, which is how keys absent from the store
  -- accumulate in it forever and the "200 categories" bound starts applying to
  -- phantoms. Recorded as D14; closed here by deleting both together.
  redis.call('DEL', KEYS[1], KEYS[2])
  redis.call('ZREM', KEYS[3], key)
  return nil
end

if #kept < #entries then
  redis.call('DEL', KEYS[1])
  redis.call('RPUSH', KEYS[1], unpack(kept))
  redis.call('PEXPIRE', KEYS[1], ttl)
end

local turn = redis.call('INCR', KEYS[2])
redis.call('PEXPIRE', KEYS[2], ttl)
redis.call('ZADD', KEYS[3], now, key)
return kept[((turn - 1) % #kept) + 1]
`;

/**
 * Writes a variant, trims the category, and evicts the least recently served.
 *
 * KEYS: variants, turn, index.
 * ARGV: now (ms), ttl (ms), normalised key, entry, variants per category,
 * max categories, key namespace.
 *
 * C4.3 — the newest entries are kept, which is the Python's `entries[-N:]`: the
 * oldest by insertion is dropped, not the least served.
 */
export const PUT_SCRIPT = `
${LIVE_ENTRIES}
local now, ttl, key, entry = tonumber(ARGV[1]), tonumber(ARGV[2]), ARGV[3], ARGV[4]
local variants, maxCategories, namespace = tonumber(ARGV[5]), tonumber(ARGV[6]), ARGV[7]
local _, kept = live(KEYS[1], now, ttl)

kept[#kept + 1] = entry
local first = math.max(1, #kept - variants + 1)
redis.call('DEL', KEYS[1])
for i = first, #kept do redis.call('RPUSH', KEYS[1], kept[i]) end
redis.call('PEXPIRE', KEYS[1], ttl)
redis.call('ZADD', KEYS[3], now, key)

-- Eviction last, and after the ZADD: a category written now is the most recently
-- used, so it must be in the index before the oldest are counted off. Doing it
-- the other way round can evict the entry this very call just wrote.
local over = redis.call('ZCARD', KEYS[3]) - maxCategories
if over > 0 then
  local stale = redis.call('ZRANGE', KEYS[3], 0, over - 1)
  for i = 1, #stale do
    redis.call('DEL', namespace .. ':variants:' .. stale[i], namespace .. ':turn:' .. stale[i])
    redis.call('ZREM', KEYS[3], stale[i])
  end
end
return 1
`;

/**
 * What the cache holds, for `GET /api/usage`.
 *
 * KEYS: index. ARGV: now (ms), ttl (ms).
 * Returns {categories, articles}.
 *
 * Expired-but-unpurged entries are **not** counted. The Python's `stats()` sums
 * raw list lengths while its `get` and `put` filter, so the number it publishes
 * disagrees with the cache it describes — the second half of D14.
 */
export const STATS_SCRIPT = `
${LIVE_ENTRIES}
local now, ttl = tonumber(ARGV[1]), tonumber(ARGV[2])
local keys = redis.call('ZRANGE', KEYS[1], 0, -1)
local categories, articles = 0, 0
for i = 1, #keys do
  local _, kept = live(ARGV[3] .. ':variants:' .. keys[i], now, ttl)
  if #kept > 0 then
    categories = categories + 1
    articles = articles + #kept
  end
end
return {categories, articles}
`;
