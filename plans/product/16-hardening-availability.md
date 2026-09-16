# Track O — O.1 to O.3, what stops the service serving a room

The three availability steps of `16-hardening.md`, which keeps the frame and the
step table. Split out when that file reached the 200-line rule, the way phase 1
splits — the decisions live beside the step they were taken for, and the frame
stays readable on its own.

All three are done. What they have in common is why they are worth a satellite:
**each is a failure the comment directly above the code says is handled**, so
the interesting part of each entry is not the fix but the sentence that was
already there and was not true.

### O.1 — the socket's own `error`

`ws` emits `error` on the `WebSocket`, not only on the TCP socket under it, and
an `error` event with no listener is what Node's `EventEmitter` throws. One
malformed frame — an invalid UTF-8 sequence is two bytes — takes the process
down with every room it holds.

The fix is a listener. What it should *do* was the only decision, and it is
**swallowed rather than logged** — the shape `redis.ts`, `bus.ts` and `queue.ts`
all use. `server.ts` takes every collaborator as a parameter and owns no logger,
and `ws` follows the error with a `close` the handler already acts on. What is
lost is the diagnosis; adding a logging port to `ServiceOptions` for it is a
step of its own, and `12-realtime-debt.md` says so rather than pretending the
trade did not happen.

**The test is the probe**: a raw client, a handshake, two bytes, and the service
still answering afterwards. It must drive a real server on a real port — a mock
would prove the mock, which is the argument `server.test.ts` already makes — and
it asserts on `uncaughtException` rather than on the runner falling over, because
a case that only fails by taking the runner down is a case nobody can read.

Worth checking in the same step, and only because it is the same class: whether
anything else in either service registers a handler on an emitter after an
`await`. `redis.ts`, `bus.ts` and `queue.ts` all carry `.on('error')` already,
each with a comment saying why, so the answer is probably yes — but *probably*
is what this step exists to replace.

### O.2 — the `close` handler, before the awaits

`accept` registers `socket.on('close', …)` after `roomExists`, `tokens.claim`,
`subscriptions.listen`, `scheduler.cancel` and the settled join. A socket that
closes inside that window never reaches it, and the connection stays in the
registry for the life of the process: the nickname is locked against its own
owner, and the roster keeps a player who will never be ready — so the round
never starts.

The handler is registered immediately after `connections.add`, with no `await`
between the two, so the event cannot be missed. **What it does is deferred**, and
that is the part that needed care: a `leave` must not reach the room before the
`join` it undoes. So the handler drops the connection from the registry at once —
which is the half that was leaking — and records that it closed; the departure
itself runs from whichever of the two comes second, the handler or the settled
join. Neither can run it twice, because no `await` separates the assignment from
the check.

**The test is the probe**: a store whose reads take thirty milliseconds — a
hosted Redis, not a slow one — a client that opens and closes at once, and a
registry that is empty afterwards. A second case takes the half a player would
notice: the nickname is hers again when she comes back **with her token**, which
is what a real client sends. Without one the slot is deliberately unreclaimable
(D5, `tokens.ts`), and the first draft of this test asserted against that rule
rather than against the bug.

### O.3 — a Redis connection that comes back

`lazyRedis` and `createRedisBus` reset their memoised connection only when the
first `connect` rejects. With `reconnectStrategy: false`, a connection that
succeeds and then drops is dead for ever, and the instance answers every message
with *the room could not be reached*.

Two ways, and the step should say which and why:

- **Clear the memo when the client closes** — an `on('error')`/`on('end')` that
  drops `pending` so the next call opens a fresh one. It is what both comments
  already claim happens, and it keeps the property they were written for: no
  caller waits on a connection already known to be down.
- **Let node-redis reconnect**, with a strategy rather than `false`. Simpler, but
  it gives back the failure mode `REDIS_TIMEOUT_MS` exists to prevent — a call
  that does not settle while the driver retries behind it.

**The first was taken** for the room's store and for the bus's *publisher*: it
is what both comments already claimed, and it keeps the property they were
written for. `isOpen` is what the memo is checked against, because a client with
no reconnection strategy emits `error` twice and **never emits `end`** — probed
rather than assumed, so there is no event to hang the recovery on.

**The bus's listener took the second, and the asymmetry is the finding.** The
argument against a reconnection strategy is that it leaves a *caller* waiting on
a connection known to be down — and a listener has no caller. What it produces
when it is down is silence, and a room that looks connected and hears nothing is
worse than an error, because nothing anywhere says so. So the listener retries
with a backoff and the publisher does not.

That also made a channel map unnecessary, which the first draft of this step
had: **node-redis restores its own subscriptions across a reconnection**, probed
against 6.x rather than trusted. Keeping our own copy would have been a second
record of a fact the driver already holds, and the first thing to disagree with
it.

**The test is the probe**: connect, `CLIENT KILL TYPE normal` and `TYPE pubsub`,
and call again. It needs a real Redis, like `store.test.ts`.
