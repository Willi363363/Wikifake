# Phase 5 — steps: the transport and what crosses it

> Steps 5.1 to 5.3. The phase sheet, its exit gate and where each step stands:
> `phase-05-realtime.md`. How a round begins and ends:
> `phase-05-steps-rounds.md`. What a player may do:
> `phase-05-steps-players.md`.

### 5.1 — Transport and handshake

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

Three decisions taken while writing it:

- **The script is a compare-and-set, not a reducer.** It holds one `if`, and
  it compares two integers — the phase's first pitfall says a business `if` in
  Lua is a sign of drift. Two instances that both read revision 7 do not need
  a lock: one commits 8, the other is told 7 is gone and decides again against
  8. A read-modify-write without the compare loses one of the two silently.
- **The idle TTL is a fact about the data, not a job.** Every commit refreshes
  `PEXPIRE` with `ROOM_IDLE_LIMIT_SECONDS` — the number step 4.8 already reads
  for the room cap. The BullMQ job of 5.4 announces the closure; this makes
  sure the state is gone even when it never runs.
- **Delivery is to the sockets this instance holds.** The naive version, on
  purpose: it is what a single-instance deployment needs, and 5.3 replaces it
  with a channel per room. Until then a room split across two instances hears
  half of itself. The effects this step cannot carry — `generate_article` and
  the timers — are handed to a callback rather than dropped, so the gap is
  something a test asserts on rather than something a reader has to notice.

A socket is registered **before** its own `join` is committed, which is what
stops two homonyms racing from both getting in. The visible consequence: a
player's first `lobby_update` may be somebody else's join, not their own.

**Done when**: on a local Redis, two concurrent transitions on the same
room are not lost, and the state re-read after every event is exactly the
one the reducer produced.

### 5.3 — Pub/sub broadcasting and backpressure

One Redis channel per room: any instance serves any socket. Parallel
broadcasting with a per-socket budget, dead socket evicted at the moment of
failure — today broadcasting is sequential and one slow socket slows the
whole room down.

Three decisions taken while writing it:

- **The publisher hears its own messages.** Delivery then has exactly one
  path, and "did this instance already send it locally" stops being a
  question anybody has to get right. A send-then-publish shortcut doubles
  every message for the instance that produced it, or needs a marker whoever
  touches it next has to remember.
- **A targeted `send` crosses the channel addressed to a player**, and every
  instance drops it unless it holds their socket. C1.1: a targeted message
  that fell back to a broadcast would put an error, or a hint, in front of
  the whole room.
- **The budget is checked after the write, not before.** The message that
  pushed a socket over is still handed to it; judging first would drop the
  last thing a player was told.

`send` never blocks — it appends to a buffer — so a stalled reader already
delays nobody. What the budget stops is that buffer growing until the process
runs out of memory, which turns one slow player into an availability bug.

The eviction rule is tested against connections whose backlog a test can set,
not through a real socket: the kernel's own send buffer absorbs tens of
kilobytes before `bufferedAmount` moves, so provoking it would mean pushing
megabytes through the suite to prove a comparison.

Still per instance until 5.5: the homonym refusal. A second player under the
same nickname on another instance gets in — the rules keep one player per
nickname, so the room is not doubled, but the refusal is missing. Pinned by a
test rather than left to be discovered.

**Done when**: a protocol test has two instances talking over the same
room, and a deliberately blocked socket does not delay delivery to the
other players.
