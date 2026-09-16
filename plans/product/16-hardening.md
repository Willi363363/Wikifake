# Track O — the service survives, and the page stops asking twice

| | |
|---|---|
| **State** | not started — six steps |
| **Branch** | one per step |
| **Depends on** | nothing. Every step repairs code that is already in production |
| **Delivers** | a socket service that outlives a bad frame, a dropped Redis and a slow model; and two round trips per page instead of six |

## Why this track exists

It was not planned. It comes out of a review asked for on 2026-09-16, after the
multiplayer was reported as buggy and the API as slow, and **every finding it
repairs was reproduced rather than argued about**. They are written up in
`../current-state/12-realtime-debt.md` and `../current-state/09-query-debt.md`,
with the probe that produced each one; this file is only the work.

The findings share a property worth stating once, because it is the argument for
doing this as a track rather than as asides: **each one is a failure the comment
directly above the code says is handled.** `redis.ts` promises a connection
"reopened after a failure" and reopens nothing. `server.ts` guards a generation
against a failure a hang does not produce. The `close` handler is registered
where a socket that closes early will never reach it. Nothing about these is
subtle in hindsight, and nothing about them is visible in a test: the suite is
green, all 1935 cases, and it was green while all six were true.

So the exit gate of every step below is the same shape: **a test that fails
before the fix**, written from the probe in the register. A repair with no such
test is this track happening again in six months.

## What is deliberately not here

- **The client's retry loop**, which reconnects once a second for ever with no
  backoff. It is recorded, and it is a decision about what a player should see
  rather than a defect: capping it means showing them something when the cap is
  reached, and that is a screen rather than a constant.
- **A tab with no nickname**, which waits on a badge reading *en attente*. Also
  recorded. It needs a way out — a prompt, or a redirect to `/play` — and
  choosing which is a product decision this track should not make in passing.
- **The room-state shape beyond O.5.** Moving the article out of Redis entirely
  is a bigger change with a bigger argument; O.5 takes the measured cost out
  without redesigning where a round lives.

## Steps

| # | Step | State |
|---|---|---|
| O.1 | The socket's own `error`, which nobody is listening for | ⬜ |
| O.2 | The `close` handler, registered before anything can be awaited | ⬜ |
| O.3 | A Redis connection that actually comes back | ⬜ |
| O.4 | A generation that ends, one way or the other | ⬜ |
| O.5 | An event that changes nothing writes nothing | ⬜ |
| O.6 | The session, read once a request | ⬜ |

### O.1 — the socket's own `error`

`ws` emits `error` on the `WebSocket`, not only on the TCP socket under it, and
an `error` event with no listener is what Node's `EventEmitter` throws. One
malformed frame — an invalid UTF-8 sequence is two bytes — takes the process
down with every room it holds.

The fix is a listener. What it should *do* is the only decision: an `error` on a
client socket is that client's problem, so it is logged and the socket is left to
close itself, the way a malformed JSON frame already is.

**The test is the probe**: a raw client, a handshake, two bytes, and the service
still answering afterwards. It must drive a real server on a real port — a mock
would prove the mock, which is the argument `server.test.ts` already makes.

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

The handler has to be registered **at the top of `accept`**, beside the `message`
one, which is already registered before the join for exactly this reason and
says so. What it does then needs care: a close that arrives before the join has
settled must still settle a `leave`, and must not do so before the join it is
undoing. The message chain (`queued`) is the existing answer to that ordering and
should be the one used.

**The test is the probe**: a store whose reads take a few dozen milliseconds, a
client that opens and closes at once, and a registry that is empty afterwards.

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

The first is the one that matches the stated design. Whichever is chosen, **the
bus needs more than the room does**: its subscriptions do not survive a new
connection, so a reopened listener has to re-subscribe to every channel it held
or the rooms it serves go silent while looking connected.

**The test is the probe**: connect, `CLIENT KILL`, and call again. It needs a
real Redis, like `store.test.ts`.

### O.4 — a generation that ends

No `AbortSignal` on the Wikipedia calls, none on the model call, no
`maxDuration` on any route. `server.ts` guards the multiplayer generation with a
`.catch`, and its comment names the failure it is for: *a room left in
`generating` waits for an article that is not coming*. **A hang is not a
rejection**, so the guard never runs and the room waits for the idle alarm, an
hour later. Solo holds the request open instead.

One deadline, in `@wikifake/domain` beside the other numbers the game agrees on,
carried by `AbortSignal.timeout` into `fetchRenderedPage`, `searchTitles` and
`falsify`. A timed-out generation then *is* a rejection, which is what every
caller already handles.

The number is a decision the step has to make and defend: long enough for a slow
model on a real article, short enough that a player is told rather than left. It
belongs beside `ROOM_IDLE_LIMIT_SECONDS`, not in three files.

### O.5 — an event that changes nothing writes nothing

Measured: a room in a round holds **20.3 KiB** of state, because `RoundState`
carries the article and the solution; `cursor` returns that state **unchanged**;
and `apply` serialises and rewrites it anyway, under a compare-and-swap that
bumps the revision. Four players at the clients' own pacing move ~2.6 MB/s
through Redis, none of which changes anything — and the revisions they burn are
what make a real event lose its ten retries and tell the player the room is gone.

The narrow fix is the honest one: **when the reducer returns the state it was
given, publish the effects and skip the write.** It is an identity check on the
value the reducer already returns, it changes no rule, and it removes the write,
the revision bump and the contention together.

Two things it must not break, and both need a test:

- **The idle clock.** `armFor` re-arms `room_idle` on every event, so a room
  where the only traffic is cursors must still not be reaped. The alarm is the
  scheduler's, not the store's, so skipping the *write* need not skip the arm —
  but it is the trap, and it is worth an explicit case.
- **The TTL.** The swap script refreshes the key's expiry. A room whose only
  traffic is chat for an hour must not expire out from under itself, so the
  step either touches the expiry without rewriting the value, or states why it
  does not have to.

Re-arming BullMQ twice per event is the other half of the per-frame cost, and it
is **left for later on purpose**: it is a change to what an alarm means, not to
what a write costs, and this step is already the largest here.

### O.6 — the session, read once a request

Measured: `/fr/profile` runs nine queries and six of them are the same `session`
and `user` rows, read three times with identical parameters. `/fr/shop` eleven,
`/fr/quests` sixteen, same six. Three callers that do not know about each other:
`adminHere()` in the layout — on every page since L.5 — the page itself, and
`readViewer()`.

Two fixes, not exclusive, and the step should take both:

- **React's `cache()`** around the session read, which dedupes within one render
  pass. There is none anywhere in `apps/web/src` today.
- **`session.cookieCache`** in the Better Auth options, which removes the read
  entirely for most requests.

**The test is a count, not a stopwatch.** A timing assertion measures the runner
— the argument `10-test-debt.md` already makes about `until` — so what this
locks is *how many times the session was asked for*, with a counting fake in
front of the auth instance.

## Exit gate

- Every step carries a test that fails without its fix, written from the probe
  in the register.
- The service survives, on a real port: two bytes of invalid UTF-8, a socket
  closed mid-join, and a Redis killed under it.
- A room whose only traffic is cursors writes no state and is still reaped on
  time.
- A signed-in page reads the session once.
- `12-realtime-debt.md` and `09-query-debt.md` lose the entries this track
  closes, in the pull request that closes them.
