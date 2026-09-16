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
entry below was **reproduced** rather than reasoned about; the probe that did it
is described so it can be run again.

The first four came out of one reading session and share a shape: **each is a
failure the comment above the code says is handled.**

## One malformed frame kills every room on the instance

**The worst of them, and the cheapest to trigger.**

`server.ts:223` accepts a socket and registers `message` and `close`. It
registers **no `error` listener**, and `ws` emits one on the WebSocket itself:
`receiverOnError` at `websocket.js:1218` calls `websocket.emit('error', err)`.
An `error` event with no listener is what Node's `EventEmitter` throws, so the
exception reaches nobody and the process exits — with every room it was holding.

Reproduced: a raw TCP client, the handshake, then a text frame whose payload is
`0xFF 0xFE` — two bytes that are not valid UTF-8.

```
handshake accepted; sending a text frame with invalid UTF-8
!!! UNCAUGHT EXCEPTION — every room on this instance dies:
    Invalid WebSocket frame: invalid UTF-8 sequence
```

**It needs no account and no room.** The origin check reads a header any
non-browser client sets itself, and the frame is sent before any rule is
consulted. An invalid opcode, a set RSV bit, an unmasked frame and an invalid
close code reach the same handler.

It is also reachable **without an attacker**: a proxy that corrupts a frame, or
a client with a bug, produces the identical crash.

A TCP reset does *not* do it — `socketOnError` handles that path and the
registry is cleaned up correctly, which was checked rather than assumed. The
gap is the WebSocket's own `error`, not the socket's.

What it costs on the current plan: Render restarts the service, and
`05-known-debt.md` already records that round timers do not survive a restart on
a Key Value instance with no persistence. So one frame ends every round in
flight on that instance, and the rounds do not end — they hang.

## A socket that closes while it is still joining is never forgotten

`accept` registers `socket.on('close', …)` at `server.ts:365` — **after** four
awaits: `roomExists`, `tokens.claim`, `subscriptions.listen`,
`scheduler.cancel`, and the settled join itself. A client that closes inside
that window fires `close` before anything is listening for it.

Reproduced with a store whose Redis answers in 30 ms — a hosted instance across
a network rather than a loopback — and a client that opens a socket and closes
it straight away:

```
registry size after the close: 1
still holds Ada? true
```

Three things follow, and they last for the life of the process:

- **The nickname is locked.** `connections.holds` is consulted before the token
  claim, so the rightful owner reconnecting is refused `name_taken` — *"Quelqu'un
  dans ce salon porte déjà ce nom"* — about themselves.
- **The roster keeps a phantom.** No `leave` is ever settled, so the player
  stays in the room's state. `everyoneReady` is `players.every(ready)`, so one
  phantom that never readies is a round that never starts.
- **The subscription is never released**, since `stopListening` is in the same
  handler.

The window is the whole join, and the join is the slowest thing a socket does.

## Redis never comes back, and both places say they handle it

`redis.ts:65` and `bus.ts:56` memoise a connection and reset it **only when the
initial connect rejects**. Both carry `reconnectStrategy: false`, so node-redis
opens no new socket of its own. A connection that succeeds and then *drops* —
an idle reaper, a Key Value restart, a network blip — leaves a memoised client
that is closed for ever.

Both comments promise the opposite:

> *"A connection opened on first use, and **reopened after a failure**. […] The
> next call opens a fresh one, which is the same recovery without the wait."*
> — `redis.ts:58`
>
> *"Both opened lazily […] and **both cleared on failure** — a memoised
> rejection keeps the room unreachable long after Redis came back."*
> — `bus.ts:48`

Reproduced by connecting, proving both work, then `CLIENT KILL TYPE normal` and
`TYPE pubsub` from a second connection:

```
before drop  — eval: 1
  [subscriber received] hello
killed normal: 2 pubsub: 1
after drop attempt 1 — REJECTED: The client is closed
after drop attempt 2 — REJECTED: The client is closed
after drop attempt 3 — REJECTED: The client is closed
after drop — bus.publish REJECTED: The client is closed
```

After that the instance serves nothing: `rooms.apply` rejects, `settle` throws,
and every message is answered with `apologise(connection, 'room_not_found')` —
*"Ce salon n'est pas ouvert"* — to players sitting in the room. Published
effects go nowhere and the lost subscriptions are never re-established, so a
room that looks connected receives nothing.

**The asymmetry is the tell**: BullMQ runs on `ioredis`, which reconnects by
default, so the alarms come back and the room does not. A round whose timer
fires against a store that cannot be read is the state this produces.

## Nothing bounds a generation, and the guard was written for a rejection

`source.ts` calls `transport.fetch` with no `AbortSignal` and `falsify` calls
`generateText` with no `abortSignal`. No route exports `maxDuration`.

`server.ts:133` guards the multiplayer generation with `.catch(() => ({ ok:
false }))`, and its comment names exactly the failure it is meant to prevent:

> *"a room left in `generating` waits for an article that is not coming — which
> is exactly the state the current server gets stuck in."*

**A hang is not a rejection.** Wikipedia or the model answering slowly and never
finishing produces no exception, so the catch never runs, `article_ready` never
arrives, and the room waits in `generating` until the idle alarm reaps it an
hour later. Solo has the same shape with a different victim: `POST
/api/game/start` holds until the platform's own timeout.

## The retry budget runs out, and the player is told the room is gone

`store.ts:130` retries a lost compare-and-swap ten times and then throws;
`server.ts:297` turns the throw into `apologise(connection, 'room_not_found')`.

Four writers contending on one room key, unpaced, against a **loopback** Redis:

```
5531 cursor applies in 4.0s (1383/s), 1104 gave up after 10 attempts
```

Seventeen percent. At the clients' real 60 ms pacing on the same loopback,
**none** did — so this is not something a player meets on a developer's machine.
The distance between the two numbers is round-trip latency, and a hosted Redis
adds one to two orders of magnitude of it to every attempt.

What a player would see is a round in front of them and *"Ce salon n'est pas
ouvert. Le code est peut-être erroné, ou tout le monde en est parti."*

The traffic that fills the budget is the cursor traffic measured in
`09-query-debt.md` — sixteen frames a second per player, each one rewriting
20 KiB the reducer did not touch. The two findings are one problem seen from
both ends: **the writes that change nothing are what make the writes that
matter lose**.

## The client retries for ever, once a second, with no backoff

`provider.tsx:169` — `retry.current = setTimeout(open, RETRY_MS)` with
`RETRY_MS = 1000`, no attempt cap and no growth. A service that is down is asked
again by every open tab, once a second, indefinitely.

On its own that is a decision one can defend. Beside the crash above it is an
amplifier: the instance restarts into every tab reconnecting at once.

## A tab with no nickname waits for ever, and says "en attente"

`room-gate.tsx:77` keys its effect on `[code]` alone. When `readNickname()`
answers null it sets the identity to null and, since the code does not change,
**never asks again**. The provider stays idle, the socket never opens, and
`room.tsx:206` renders a badge reading *"en attente"* with nothing to act on.

The nickname is in `sessionStorage`, which is per tab. Reaching this needs a
room URL opened in a tab that never went through `/play` — a second tab, or a
restored session. There is no share-a-link feature today, which is the only
reason it is rare; adding one would make it the first thing a guest meets.
