# Track O — O.4 to O.6, what a round and a page cost

The three remaining steps of `16-hardening.md`, which keeps the frame and the
step table. O.4 is a deadline nothing has; O.5 and O.6 are the two measurements
of `../current-state/09-query-debt.md`, which is where their numbers live.

None of them is started.

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
