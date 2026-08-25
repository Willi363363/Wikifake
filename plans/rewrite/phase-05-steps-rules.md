# Phase 5 — steps: the rules over the wire

> Steps 5.4 to 5.7. The phase sheet, its exit gate and where each step stands:
> `phase-05-realtime.md`. The transport: `phase-05-steps-transport.md`.

### 5.4 — BullMQ timers

Delayed jobs for round end by timeout, idle-room TTL and item waves. This
is what closes "the server never enforces the end of a round": today
`time_limit` is only enforced by the client.

Four decisions taken while writing it:

- **BullMQ is handed `ioredis`, a second Redis driver.** Not a preference:
  version 6 made `ioredis` optional and offers node-redis instead, but its
  **worker** does not process a job through one — armed alarms never ring and
  `close()` never settles. The supported client is the one that works.
- **The nine item waves are armed together, at fixed offsets**, rather than
  each arming its successor. BullMQ will not remove a running job, so an alarm
  re-arming its own id from inside its own handler is quietly ignored. The
  schedule is fixed anyway.
- **A job id cannot contain a colon** — it is what separates the parts of
  BullMQ's own keys — so alarms are keyed `A1B2C3-round_end`.
- **Every event for a socket is queued, in order.** The message handler is now
  registered *before* the join is settled: with it registered after, a client
  that sent the moment its socket opened had those frames dropped. Found by a
  test whose first request paid a connection warm-up, and it is a real defect
  rather than a test artefact.

**Done when**: a round whose last non-submitted player disconnects ends by
server-side timeout, and an idle room disappears when its TTL expires —
both verified by protocol tests.

### 5.8 — The article pipeline

`generate_article` is an effect the reducer emits and nothing in this service
answers, so a round cannot start: `article_ready` is the only way into one
(D3), and nobody sends it. The service already has the door — `settle`, the
same one an alarm uses — and `@wikifake/article` already has the chain. What is
missing is the piece between them: take the topic, produce a round or a
failure, and send back `article_ready` or `article_failed`.

This step was not in the original plan. It surfaced in 5.4, whose criterion
needs a round to exist, and is written down rather than absorbed into whichever
step noticed it last.

It also owns the **round clock**, which nothing supplies today. The reducer
takes `elapsedSeconds` as a parameter and the transport never stamps it, so
every message is decided as though the round had just begun. Two rules read it
and are wrong because of it: `HINT_LOCK` blocks its target until second 20 of a
clock stuck at 0, so it blocks for ever; and every time bonus is computed on a
full remaining limit. Found in 5.6, whose `FREEZE_TIME` criterion reads a bonus
rather than a block for that reason. It belongs here because the instant a round
starts is decided here, and nowhere else can know it.

**Done when**: a topic voted for in a room produces a round over the socket,
with the model and Wikipedia mocked; a topic that yields no article falls
back to the next candidate and then to the lobby (C3.7); and a message settled
during a round carries the seconds elapsed since it started.

### 5.5 — Reconnection

Session token carried by the client, `connected: false` actually written on
disconnect, grace window before eviction. During the window, the nickname
cannot be taken over by a third party.

Three decisions taken while writing it:

- **The client owns the token, and the server never mints one.** It generates a
  secret, keeps it for as long as its tab lives, and sends it as a query
  parameter on every connection including the first. No secret travels
  downwards, and the protocol grows no message for any of this.
- **A connection that brings no token plays, and can never come back.** Its slot
  is bound to a value no client can present. That fails closed: the alternative
  is a slot anybody can walk into by typing a nickname, which is worse than
  today, where a dropped player is deleted and has nothing left to steal.
- **`leave` and `evict` are two events.** A dropped socket marks the player away
  and takes nothing; the eviction at the end of the grace window is the only
  thing that removes them, and therefore the only thing that can end a round
  early or close a room. That is why the round-end tests of 5.4 now say
  "evicted" — the same rule, moved to the event that means it.

`GRACE_SECONDS` is thirty: long enough for a lift, a tunnel or a laptop lid,
short enough that a room is not held by somebody who closed the tab, and well
inside the shortest round the contract allows.

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

Three of those four are rules, and phase 1 already wrote them:
`validateTargets`, `setReady`'s refusal outside the lobby and
`applyItemToTarget`'s time penalty each have their unit test in
`@wikifake/domain`. What this step adds for them is not a second
implementation but the proof that they are **reachable from a socket** — a
rule nothing routes to is a rule that is not enforced, and that is exactly
what D6 and D7 are.

Only the throttle is new, and it is the only one of the four that never
reaches the rules at all: a frame over the limit is dropped in the transport.

Four decisions taken while writing it:

- **A frame over the limit is dropped in silence, not refused.** An error per
  dropped frame turns a flood of small messages into a flood of replies, which
  is the amplification the throttle exists to prevent. The sender loses nothing
  they can notice: the next position and the next tally supersede the ones that
  did not make it.
- **Dropped where it stands, rather than held back and sent late.** Coalescing
  would need a timer per socket per type and would deliver a position the player
  has already left. What arrives is the first frame of a burst, not the last.
- **The cursor's interval is carried over exactly**: 40 ms, the value of
  `CURSOR_MIN_INTERVAL`, so a limit is not quietly loosened during a rewrite.
  `live_score` gets 200 ms — a human does not tick five paragraphs a second.
- **The allowance is per socket and per type.** Per socket, so a flood costs its
  sender their own frames and nobody else's; per type, so a cursor flood cannot
  silence a score.

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
