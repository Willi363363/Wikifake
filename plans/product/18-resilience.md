# Track Q — the promise nobody was holding, and a budget read off the wrong host

| | |
|---|---|
| **State** | 🔶 planned — five steps, none started |
| **Branch** | one per step |
| **Depends on** | nothing. Every step repairs code that is already in `staging` |
| **Delivers** | a service that survives a collaborator saying no, and a client that waits as long as *this* deployment needs |

## Why this track exists

A review on 2026-09-17, over the whole repository. **Three of its findings were
reproduced with a probe before being written down**, and one of them is a
regression this project shipped the same day.

They share the shape track O's six shared, one turn further out. O.1 fixed the
`error` **event** nobody listened for; three of the five below are the `Promise`
nobody holds — the same failure, on the other half of Node's error model, two
lines away from the fix that was already written.

## Q.1 comes first, and it is ours

`render.yaml:70` sets `REALTIME_GRACE_SECONDS = 90`, and says why in the line
above it: *"Longer than the domain's 30 because this host sleeps: a cold start
is about a minute, and a seat released before the player's socket can come back
is a seat lost to the platform rather than to the player."*

**P.1 bounded the client's retry loop at `GRACE_SECONDS`, the domain's 30.** Its
sheet named the risk — *"`REALTIME_GRACE_SECONDS` can move the window on the
server and the client cannot read it… it is not worth a protocol change for a
value nobody has ever set"* — and the premise was false when it was written.
The value has been set since the service moved to Render, for a reason recorded
in three places: `render.yaml`, `05-known-debt.md`'s *There is no socket
heartbeat, and the host sleeps*, and the free tier's own documentation.

What it costs, on the deployment the project actually runs: the service spins
down after fifteen minutes idle and takes about a minute to wake. Before P.1 a
lobby left alone reconnected by itself and nobody saw anything. After P.1 every
player in it is shown *Connexion perdue* at thirty seconds — **while the server
is still holding their seats for another sixty** — and told to press a button
the platform was about to make unnecessary.

**The original defect was the rate, not the total.** *Once a second, for ever,
from every open tab* is an amplifier; that is what `12-realtime-debt.md`
recorded and what the backoff fixes. The ceiling was this session's own
addition, and it is the part that broke. So Q.1 keeps the backoff, and the
budget stops being a number the client guesses:

1. **Keep retrying**, with the delay capped rather than the attempts — the storm
   is gone once the interval grows, and a client that is still trying costs one
   socket a quarter of a minute.
2. **`lost` is reached by silence, not by arithmetic** — a long threshold well
   past any cold start, so the card still exists for a service that is actually
   gone.
3. Whichever number is chosen, **it may not be read off `GRACE_SECONDS`**: that
   constant describes the room's seat, not the host's sleep, and P.1 conflated
   them.

## The three unheld promises

Each was reproduced with a probe against the real service, and each probe is in
`../current-state/12-realtime-debt.md` with the assertion it printed.

- **Q.2 — `server.ts:237`.** `void accept(socket, request)` has no `catch`, and
  `accept` awaits `roomExists`, which in production is a **Postgres** query
  (`main.ts:51`). A database blip during a handshake is an unhandled rejection;
  with no `SENTRY_DSN` — CI, and any deployment that has not set one — Node's
  default ends the process and every room on it.
- **Q.3 — `server.ts:348`.** The departure chain, `enqueue(...).then(arm)`,
  handles the first promise and not the one `.then` returns. `scheduler.arm`
  reaches Redis through BullMQ, so **every player who leaves during a Redis
  outage** produces one.
- **Q.4 — `subscriptions.ts:53`.** `listen` claims the map before awaiting
  `bus.subscribe`, which is right for two sockets arriving together and wrong
  for a subscribe that **rejects**: the placeholder stays, with a no-op `stop`,
  and every later `listen` for that room increments a counter and subscribes
  nothing. That instance is deaf for that room until it restarts, Redis
  recovered or not.

## Q.5 — the orphan that follows from them

**Deduced from the three above rather than reproduced**, and written down as
such. If anything between `connections.add` and `joined = true` throws, the
`close` handler runs with `joined` still false, so `depart()` never does: no
`leave`, no grace alarm, the subscription never released, and the roster keeps
a player who will never be ready — **the symptom O.2 fixed**, reached by an
exception instead of by an early close.

Q.2 and Q.3 make the throw possible; this is what the room looks like
afterwards. A step of its own because the repair is different: the ordering
flags need a third state, or the whole body needs a `try`.

## Steps

| # | Step | State |
|---|---|---|
| Q.1 | The client waits as long as this host needs, not as long as the domain says | ⬜ |
| Q.2 | A handshake that cannot reach the database refuses, and does not throw | ⬜ |
| Q.3 | A departure that cannot arm its alarm still departs | ⬜ |
| Q.4 | A subscription that failed once can be made again | ⬜ |
| Q.5 | A socket that throws mid-join leaves the room like one that closed | ⬜ |

## Exit gate

- **A test per step that fails without its fix**, checked by removing the fix.
  Q.2, Q.3 and Q.4 already have their probe: each printed its failure before
  this sheet was written.
- Q.1 is the exception and needs a different gate, because no unit test can see
  a host sleeping: the criterion is that **the number the client waits is
  derived from the deployment**, and that `render.yaml` and the client cannot
  disagree without something failing.
- `12-realtime-debt.md` loses the four entries this track closes, in the pull
  requests that close them — and `05-known-debt.md`'s *There is no socket
  heartbeat* is rewritten by Q.1 rather than left describing a retry loop that
  no longer behaves that way.

## What is deliberately not here

- **The socket heartbeat.** It is the honest fix for the sleeping host and it is
  a new protocol message, regenerated `plans/protocol/` pages and a snapshot
  test — recorded in `05-known-debt.md` since before this track, and still its
  own step.
- **Rate limiting the two routes that call a model.** Recorded in
  `05-known-debt.md` by this review. It is a policy decision — who is allowed
  how much — and not a repair.
