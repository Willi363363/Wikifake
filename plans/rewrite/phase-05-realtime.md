# Phase 5 — Realtime

| | |
|---|---|
| **State** | done — exit gate passed |
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

Eight steps, so the definitions live in three sheets. **The tables below are
the only place that says where a step stands** — the sheets define the work
and its completion criterion, and carry no state.

| # | Step — the transport and what crosses it | State |
|---|---|---|
| 5.1 | Transport and handshake | ✅ done |
| 5.2 | Room state in Redis | ✅ done |
| 5.3 | Pub/sub broadcasting and backpressure | ✅ done |

Definitions: `phase-05-steps-transport.md`.

| # | Step — how a round begins and ends | State |
|---|---|---|
| 5.4 | BullMQ timers | ✅ done |
| 5.8 | The article pipeline | ✅ done |

Definitions: `phase-05-steps-rounds.md`.

| # | Step — what a player may do | State |
|---|---|---|
| 5.5 | Reconnection | ✅ done |
| 5.6 | Hardening client messages | ✅ done |
| 5.7 | Host authority and room end | ✅ done |

Definitions: `phase-05-steps-players.md`.

5.8 was not in the original plan and was not a change of scope: `generate_article`
is an effect the reducer emits and nothing in this service answered, so a round
could not start at all. Written down when 5.4 found it, rather than absorbed into
whichever step noticed it last.

5.1 creates `apps/realtime` itself — phase 0 left the `apps/` tree "empty but
declared" — so it comes first whatever else is urgent. 5.2 and 5.3 come
before the rest because everything after them has to be true across
instances, and state creeping back into process memory only shows up with
several.

## Exit gate

Passed. Where each one is proved, in `apps/realtime/src`:

- **The server-authority and transport-robustness guarantees pass as protocol
  tests against the service, on the multiplayer side** — `server.test.ts`
  (handshake, frames, refusals), `hardening.test.ts` (throttles, targets, frozen
  options, `FREEZE_TIME`), `authority.test.ts` (host-only actions that change
  nothing when refused, promotion, client-declared penalties worth zero).
- **A round survives one player's network cut** — `reconnect.test.ts`: score,
  items and paid hints come back, and a homonym cannot take the seat during the
  grace window.
- **Two instances serve the same room in the test suite** — `broadcast.test.ts`,
  over a real Redis channel.
- **Round end by timeout and idle-room TTL are effective** — `timers.test.ts`
  over BullMQ, and `authority.test.ts` for the row an idle room leaves behind.

And the one the gate did not name, because nobody had noticed it was missing: a
multiplayer round can start at all (`article.test.ts`, `generation.test.ts`).

## What phase 5 leaves for later

Recorded rather than absorbed:

- **A multiplayer round's *results* are not persisted.** The `game`, its
  positions and its participants are written when the round starts (C4.6 needs
  it); the scores stay in Redis and reach the players through `game_end`. Solo
  writes them through `recordSubmission`; multiplayer has no equivalent yet.
- **A room's `phase` and `host_name` columns are never written.** The live room
  is Redis's; those columns date from phase 2 and no reader depends on them.

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
