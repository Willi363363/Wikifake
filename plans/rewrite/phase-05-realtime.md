# Phase 5 — Realtime

| | |
|---|---|
| **State** | in progress — five steps done |
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

Seven steps, so the definitions live in two sheets. **The tables below are
the only place that says where a step stands** — the sheets define the work
and its completion criterion, and carry no state.

| # | Step — the transport and what crosses it | State |
|---|---|---|
| 5.1 | Transport and handshake | ✅ done |
| 5.2 | Room state in Redis | ✅ done |
| 5.3 | Pub/sub broadcasting and backpressure | ✅ done |

Definitions: `phase-05-steps-transport.md`.

| # | Step — the rules over the wire | State |
|---|---|---|
| 5.4 | BullMQ timers | ✅ done |
| 5.5 | Reconnection | ✅ done |
| 5.6 | Hardening client messages | to do |
| 5.7 | Host authority and room end | to do |
| 5.8 | The article pipeline | to do |

Definitions: `phase-05-steps-rules.md`.

5.8 was not in the original plan and is not a change of scope: `generate_article`
is an effect the reducer emits and nothing in this service answers, so a round
cannot start at all. Written down when 5.4 found it, rather than absorbed into
whichever step noticed it last.

5.1 creates `apps/realtime` itself — phase 0 left the `apps/` tree "empty but
declared" — so it comes first whatever else is urgent. 5.2 and 5.3 come
before the rest because everything after them has to be true across
instances, and state creeping back into process memory only shows up with
several.

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
