# Track O — the service survives, and the page stops asking twice

| | |
|---|---|
| **State** | ✅ done — six steps, each with a test that fails without its fix |
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
| O.1 | The socket's own `error`, which nobody is listening for | ✅ |
| O.2 | The `close` handler, registered before anything can be awaited | ✅ |
| O.3 | A Redis connection that actually comes back | ✅ |
| O.4 | A generation that ends, one way or the other | ✅ |
| O.5 | An event that changes nothing writes nothing | ✅ |
| O.6 | The session, read once a request | ✅ |

The steps themselves, with the decision each one took, are in two satellites —
`16-hardening.md` keeps the frame and the table, the way phase 1 splits:

- `16-hardening-availability.md` — **O.1 to O.3**, what stops the service
  serving a room at all.
- `16-hardening-cost.md` — **O.4 to O.6**, what a round and a page cost.

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
