# Current state — the socket service

The sixth register, and the one about **the service that holds the rooms**: what
kills the process, what leaks, and what never comes back. What a frame *costs*
is in `09-query-debt.md`, beside the other measurements.

| Register | What goes in it |
|---|---|
| `05-known-debt.md` | defects and gaps with a `file:line` |
| `06-structural-debt.md` | the shape of the repository and its code |
| `08-toolchain-debt.md` | the commands you run |
| `09-query-debt.md` | query plans, and what a page load costs |
| `10-test-debt.md` | the suites |
| `11-promotion-debt.md` | the promotion |
| this file | `apps/realtime`: what stops it serving a room |

It was split out of `05-known-debt.md`, which had reached the 200-line rule with
these findings still to write — the same reason `09`, `10` and `11` exist. Every
entry was **reproduced** rather than reasoned about, and the probe that did it
is described so it can be run again — with one exception below, which says so
in its own first line rather than borrowing this one's credit.

**What it has held, and what closed it.** The review of 2026-09-16 found seven;
track O closed five the same day and track P closed the last two on
2026-09-17, each with a test that fails without its fix. A register that kept
fixed debt would stop being read, which is the whole reason there are six of
these files — so these are listed and not described.

| Closed | By |
|---|---|
| one malformed frame killed the process | O.1 |
| a socket closing mid-join was never forgotten | O.2 |
| a dropped Redis never came back | O.3 |
| nothing bounded a generation | O.4 |
| ten lost swaps told a player the room was gone | O.5 |
| the client retried once a second, for ever, with no backoff | P.1, and P.2's screen — **but see Q.1 below**: P.1's ceiling is itself a defect |
| a tab with no nickname waited for ever on *en attente* | P.3 |

The argument each one turned on is in `../product/16-hardening-availability.md`
and `../product/17-recovery.md` rather than repeated here.

## The client gives up before this host can wake

`render.yaml:70` sets `REALTIME_GRACE_SECONDS = 90` and says why on the line
above: the free tier spins down after fifteen minutes idle and takes about a
minute to come back, so *"a seat released before the player's socket can come
back is a seat lost to the platform rather than to the player."*

**P.1 bounded the client's retry loop at `GRACE_SECONDS`, the domain's 30**, and
its sheet dismissed this in one clause — *"not worth a protocol change for a
value nobody has ever set"*. The value has been set since the service moved to
Render. Three places said so: that file, this register's own *There is no
socket heartbeat* neighbour in `05-known-debt.md`, and the free tier's
documentation.

What it costs on the deployment the project runs: a lobby left alone for
fifteen minutes used to reconnect by itself, unnoticed. It now shows every
player *Connexion perdue* at thirty seconds, **while the server holds their
seats for another sixty**, and offers a button the platform was about to make
unnecessary.

**The original defect was the rate, not the total** — *once a second, for ever,
from every open tab*, which is what this register recorded and what the backoff
fixes. The ceiling was added on top of it and is the part that broke. Whatever
replaces it may not be read off `GRACE_SECONDS`: that constant is the room's
seat, not the host's sleep, and P.1 conflated them.

## It was empty for four hours

Written on 2026-09-17, the same day the file first said *nothing is open* and
the same day a full-repository review reopened it with four entries. That is
not an embarrassment to hide: **an empty register was a claim about how hard
anybody had looked**, and the section that said so said exactly that — *"seven
entries were found in one afternoon of looking"*. Four more were found in one
afternoon of looking somewhere else.

All four belong to **track P's successor, track Q** (`../product/18-resilience.md`).

## Three promises nobody is holding

One shape, three call sites, and it is O.1's shape one turn out. O.1 fixed the
`error` **event** nobody listened for; these are the `Promise` nobody holds —
the other half of Node's error model, and in one case two lines below the fix.

**Reproduced, each with a probe run against the real service**, and the
assertion each one printed is below.

### The handshake — `server.ts:237`

```js
socket.on('error', () => undefined);   // O.1
void accept(socket, request);          // ← no catch
```

`accept` awaits `roomExists`, which `main.ts:51` implements as a **Postgres**
query. A probe with `roomExists: () => Promise.reject(...)`:

```
expected [] to deeply equal [ "Error: the database is not answering" ]
```

With no `SENTRY_DSN` — CI, and any deployment that has not set one — Node's
default for an unhandled rejection ends the process, and with it every room the
instance holds. Sentry installs a handler when a DSN is present, which means
**the failure is worse where it is least observed.**

### The departure — `server.ts:348`

```js
void enqueue({ kind: 'leave', ... })
  .then(() => scheduler.arm({ kind: 'grace', ... }))
  .finally(() => void subscriptions.stopListening(roomCode));
```

`enqueue` returns a tracked promise and `track` attaches a `catch`, so the
first link is held. The promise `.then` returns is not. `scheduler.arm` reaches
Redis through BullMQ, so **every player leaving during a Redis outage** makes
one. A probe with a rejecting `arm`:

```
expected [ 'Error: redis is not answering' ] to deeply equal []
```

### The subscription that cannot be retried — `subscriptions.ts:53`

```js
const placeholder = { stop: async () => undefined, holders: 1 };
held.set(roomCode, placeholder);          // claimed before the await, deliberately
const stop = await options.bus.subscribe(...);   // ← if this rejects, the claim stays
```

Claiming before the await is **right** for two sockets arriving together, which
is what the comment beside it defends. It is wrong for a subscribe that
rejects: the placeholder survives with a no-op `stop`, and every later `listen`
for that room finds it, increments `holders` and subscribes nothing. A probe
counting calls to `bus.subscribe` across a failed then a healthy attempt:

```
expected 1 to be 2
```

So the instance is **deaf for that room until it restarts** — no roster, no
chat, no start — whether or not Redis came back. The listener's own reconnection
(`bus.ts`) does not help: it restores the channels the driver holds, and this
one was never subscribed.

## A socket that throws mid-join is an orphan

**Deduced from the three above, not reproduced**, and recorded as such.

If anything between `connections.add` and `joined = true` throws, `close` runs
with `joined` still false and `depart()` never runs: no `leave`, no grace
alarm, the subscription never released, and the roster keeps a player who never
readies so the round never starts. That is O.2's symptom, reached by an
exception rather than by an early close — and O.2's two ordering booleans
cannot see it, because neither is set on the throwing path.
