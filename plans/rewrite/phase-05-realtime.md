# Phase 5 — Realtime

| | |
|---|---|
| **State** | in progress — one step done |
| **Branch** | `feat/rewrite-phase-5` |
| **Depends on** | phase 4 |
| **Delivers** | `apps/realtime`: the complete multiplayer, multi-instance |

## Objective

Write the WebSocket service: `ws` behind Hono, room state in Redis mutated
by Lua scripts, broadcasting through Redis pub/sub, timers through BullMQ.
The room reducer and the protocol schemas already exist; this phase plugs
them into the real world — sockets, clock, multiple instances.

## Why now

The contract, the rules and the solo API are in place: multiplayer is the
last server piece before the frontend. This is also the phase that closes
the authority gaps of the legacy system: the server never enforces the end
of a round (a room stays in `playing` forever if the last non-submitted
player disconnects, and no idle room has a TTL); the reconnection path is
dead (nothing ever sets `connected` to `False`, so score, items and paid
hints are lost); and several client messages are neither validated nor
throttled.

## Steps

### ✅ 5.1 — Transport and handshake

Hono + `ws`, input validation through `packages/protocol`. The nickname is
validated **and URL-encoded** — it is not today, even though the server
regex allows spaces. Explicit WebSocket origins from the start.

Three decisions taken while writing it:

- **A frame has three failure modes, not one.** Too big closes without an
  answer (C5.7); unreadable answers `bad_json` and keeps the connection
  (C5.3); an unknown type is dropped in silence. The last two are told apart
  on the discriminant before the schema: a client one version ahead is
  entitled to try a message we do not know, and flooding it with rejections
  would be worse than ignoring it.
- **The socket registry is per instance, and the room state is not in it.**
  A socket is a file descriptor and cannot be shared between processes, so
  the open sockets legitimately live in memory. Until 5.2 that means the
  homonym check is per instance — which is what the current server does for
  everything, and what 5.2 fixes for the state.
- **Origins fail closed.** `REALTIME_ALLOWED_ORIGINS` is declared in
  `@wikifake/env` and falls back to `BETTER_AUTH_URL`; an empty list refuses
  every browser rather than accepting all of them. A handshake with no
  `Origin` header is accepted — browsers always send one, so its absence is a
  probe or a native client, not a bypass.

Left for phase 9: the service runs through `tsx` and has no build step.

**Done when**: the transport tests pass against the service — invalid JSON
→ `bad_json` and the connection survives, unknown type ignored, connected
homonym refused, frame beyond 64,000 characters → close 1009, nickname with
a space accepted through the encoded URL.

### 5.2 — Room state in Redis

The pure reducer from `packages/domain` decides, a Lua script applies the
transition atomically. No instance holds the truth: no room structure lives
in process memory.

**Done when**: on a local Redis, two concurrent transitions on the same
room are not lost, and the state re-read after every event is exactly the
one the reducer produced.

### 5.3 — Pub/sub broadcasting and backpressure

One Redis channel per room: any instance serves any socket. Parallel
broadcasting with a per-socket budget, dead socket evicted at the moment of
failure — today broadcasting is sequential and one slow socket slows the
whole room down.

**Done when**: a protocol test has two instances talking over the same
room, and a deliberately blocked socket does not delay delivery to the
other players.

### 5.4 — BullMQ timers

Delayed jobs for round end by timeout, idle-room TTL and item waves. This
is what closes "the server never enforces the end of a round": today
`time_limit` is only enforced by the client.

**Done when**: a round whose last non-submitted player disconnects ends by
server-side timeout, and an idle room disappears when its TTL expires —
both verified by protocol tests.

### 5.5 — Reconnection

Session token carried by the client, `connected: false` actually written on
disconnect, grace window before eviction. During the window, the nickname
cannot be taken over by a third party.

**Done when**: a test cuts the socket mid-round then reconnects — score,
items and paid hints are recovered — and a homonym is refused during the
grace window.

### 5.6 — Hardening client messages

Server throttle on `cursor` **and** `live_score` — missing on the latter
today, which is rebroadcast to the whole room without validation, an
amplification vector. `targets` of a `use_item` validated: no
self-targeting, closed target count. `set_ready` refuses a `time_limit`
from the host mid-round. `FREEZE_TIME` gets its server-side effect: the
−10 s actually eat into the time bonus instead of being purely visual.

**Done when**: each point has its protocol test — a `live_score` flood is
not rebroadcast beyond the throttle, self-targeting is refused,
`time_limit` is frozen mid-round, `FREEZE_TIME` eats into the time bonus.

### 5.7 — Host authority and room end

`force_start`, `force_pick`, `start_game` return `not_host` to a guest
without changing the room state; a guest changes their `ready` but neither
`time_limit` nor `with_items`; the next player is promoted when the host
leaves; the room disappears when the last player leaves. A single
round-start path: the reducer's.

**Done when**: the server-authority invariants pass as protocol tests on
multiplayer, including the zero breakdown for client-declared penalties.

## Exit gate

- The server-authority and transport-robustness guarantees pass as protocol
  tests against the service, on the multiplayer side.
- A round survives one player's network cut.
- Two instances serve the same room in the test suite.
- Round end by timeout and idle-room TTL are effective.

## Contract touched

See `01-contract-to-preserve.md`: **server authority** (the solution never
leaves the server, monotonic hints billed once, host role decided and
checked server-side) and **transport robustness** (nickname, homonyms,
invalid JSON, frame bounds, throttles) are the heart of the phase. The
**scoring scale** is touched at the margin through the time bonus:
`time_limit` frozen mid-round and the server-side effect of `FREEZE_TIME`.

## Pitfalls

- **No business logic in Lua.** Redis + Lua is more complex than the
  in-memory dict it replaces; the countermeasure is already decided: the
  reducer decides, the script applies. A business `if` in a Lua script is a
  sign of drift.
- **Explicit origins and tokens in this phase**, not at the end of the
  road: two hosting providers (Vercel + Fly), so CORS and WebSocket origins
  to keep in line.
- **A single round-start path.** The legacy system has two, divergent —
  that is where penalties leaked from one round to the next.
- **Test with two instances from 5.3 onwards.** State creeping into process
  memory only shows up with several instances.
- **Cancel the round-end job** when the round ends normally, otherwise it
  will fire on the next round.
