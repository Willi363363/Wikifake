# Phase 5 — steps: the rules over the wire

> Steps 5.4 to 5.7. The phase sheet, its exit gate and where each step stands:
> `phase-05-realtime.md`. The transport: `phase-05-steps-transport.md`.

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
