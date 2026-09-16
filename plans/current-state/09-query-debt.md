# Current state — what gets slow, and why

The fourth register. `05-known-debt.md` holds defects with a `file:line`,
`06-structural-debt.md` the shape of the code, `08-toolchain-debt.md` the
commands you run, `10-test-debt.md` the suites, `11-promotion-debt.md` the
promotion, `12-realtime-debt.md` what stops the socket service serving a room —
and this one holds **what is slow**: at what size, and measured rather than
assumed.

It exists because the other three had all reached their 200-line cap, and
because these findings share a shape: each is a number taken on a seeded table,
each names the plan Postgres chose, and each is worth re-measuring rather than
re-reasoning when somebody acts on it.

Every entry here should carry a measurement. A performance note without one is a
guess with a file name attached.

## `DESC NULLS LAST` in an index does not serve `ORDER BY … DESC`

Found in H.2, and it is the kind of defect that ships in silence.

**`order by x desc` means `desc nulls first` in SQL.** Drizzle's `.desc()`
produces `DESC NULLS LAST` in an *index definition* and a bare `desc` in an
*order by*, so the two do not match — and Postgres will not use the index for
the ordering. It reads every qualifying row and sorts them.

Measured on a ledger of five thousand movements, the same query either way:

```
order by seq desc              cost 139    0.77 ms   Seq Scan + top-N sort
order by seq desc nulls last   cost 0.35   0.08 ms   Index Scan, stops at row 1
```

Ten times faster, and constant rather than linear. The columns involved are
`not null`, so **the two orderings can never differ in result** — only in whether
an index may be used, which is why nothing catches it.

`queries/coins.ts` spells `desc nulls last` and says why. **What is not fixed is
everywhere else it applies**, and at least one place it demonstrably does:

- **`leaderboard_mode_score_idx` is `(mode, score DESC NULLS LAST, …)` and
  `boardQuery` orders `desc(score)`.** Probed by changing that one ordering and
  re-running G.4's volume test: the all-time board went from **45 ms to 26 ms**
  at fifty thousand entries, with all fourteen cases still passing. Reverted,
  because a performance change to a shipped step is not an aside in a step about
  a coin ledger.

Worth a sweep rather than a fix in passing: every `.desc()` in an index, against
every query that orders on it. The fix is one clause per query and the win is
measurable, so it deserves its own step and its own before-and-after.

## The all-time leaderboard reads the whole mode, because it needs a name

Moved here from `06-structural-debt.md`, where it was a pointer.

Measured in G.4 at fifty thousand entries: the daily, weekly and regional boards
answer in 2–3 ms with their range pushed into an index; the all-time board takes
45 ms, reading every entry in the mode.

**The scan is the cause — not the index, and since G.7 not the sort either.** A
board is one row per player now, so `distinct on` reduces twenty-five thousand
entries to two thousand before the ordering; but every entry is still read to
find each player's best, and deduplicating costs more than sorting did. Its cost
grows with the game's history where every other board's grows with its period.

Part of that 45 ms is the ordering mismatch above — 19 ms of it, probed. The
rest is inherent to the deduplication. The two ways out, and why forcing a
nested loop measures nothing, are in `../product/07-leaderboards-queries.md`.

## A mouse move rewrote the whole round — closed by O.5

`actions.ts:175` — `cursor` returns `state` **unchanged**, and emits one `send`
effect per other player. `store.ts:127` — `apply` serialises and writes the
state back regardless, under a compare-and-swap that bumps the revision.

`RoundState` holds `article` (every paragraph) and `solution` (every
falsification, with its explanation and its hint). Measured on a room in a round
with four players and the `chocolat` fixture: **20.3 KiB of state**, read and
rewritten on every admitted frame.

At the clients' own pacing — `THROTTLE_MS = 60`, so about sixteen moves a second
per player — four players produced 260 applies in four seconds and took the
revision from 274 to 544. That is **~2.6 MB/s of Redis traffic per room**, and
every byte of it is a state nobody changed.

Per frame, awaited one after another: `hmGet`, the swap `eval`, one `publish`
per recipient, then BullMQ's `remove` + `add` to re-arm `room_idle` — which
`arming.ts:85` does on **every** event. Seven or so round trips, times sixteen a
second, times the players in the room.

`live_score` and `chat_message` took the same path for the same reason.

**Closed by step O.5** (`../product/16-hardening-cost.md`): the store skips the
write when the reducer hands back the state it was given, which it says by
returning the same reference. Re-measured with the same probe — 260 revisions
and 5.15 MiB written in four seconds became **0 and 0**. Kept here rather than
deleted because the number is what a future change to `RoomState` should be
weighed against: the article and the solution are still in it, and the next
event that *does* change something still writes all 20.3 KiB.

## Every signed-in page read the session three times — closed by O.6

Measured on a local Postgres with `log_statement = all`, one request per page,
signed in, everything already compiled:

| Page | Queries | Of which session + user |
|---|---|---|
| `/fr/profile` | 9 | 6 |
| `/fr/shop` | 11 | 6 |
| `/fr/quests` | 16 | 6 |
| `/fr/leaderboard` | 8 | 4 |

Two queries would do. The `session` row is read three times and the `user` row
three times, with identical parameters, one after another.

There are three callers and none of them knows about the others:

- `layout.tsx:179` — `adminHere()`, which step L.5 put on **every** page so the
  bar can render the admin entry on the server;
- the page itself, where one is needed (`profile/page.tsx:40`);
- `readViewer()` at `gate.ts:40`, called by the same page a line later.

`auth()` memoises the Better Auth instance, so this is not a new client per
call — it is the same client asked the same question three times. Nothing
dedupes it: there is no React `cache()` anywhere in `apps/web/src`, and Better
Auth's own `session.cookieCache` is not configured, so each call is a round
trip.

On a loopback that is about a millisecond each and invisible. Against Neon from
a Vercel function it is four avoidable round trips on the critical path of every
signed-in page, before the page's own data.

`gate.ts:40` already carried the sentence that names the cost — *"Track I's exit
gate counts the lookups a page load costs, and this is one"* — so the lookup was
counted and the duplication was not.

**Closed by step O.6**, with React's `cache` and not with `cookieCache`: six
session-and-user reads a page became two, which is the floor. Why the second
half was refused is in `../product/16-hardening-cost.md`. Kept here because the
table above is what any later change to the layout should be measured against —
`adminHere()` still runs on every page, and it is one query that a page which
renders no admin entry does not need.

Two fixes, and they are not exclusive: wrap the session read in React's
`cache()`, which dedupes within one render; and turn on `cookieCache`, which
removes the read entirely for most requests. Both are configuration rather than
design, which is why this is a measurement and not a redesign.

## `connectFromEnv` opens a pool per caller

`client.ts:36` — `connect` calls `postgres(url, { max: 10 })` every time, and
`connectFromEnv` calls `connect`. Two callers in `apps/web` reach it and neither
knows about the other: `wiring.ts:34`, which memoises its own, and `auth.ts:109`,
which memoises a **second** one.

So a warm instance holds up to twenty connections rather than ten. Not measured
against Neon's ceiling, and recorded rather than acted on for that reason — but
Fluid Compute keeps instances alive, so the pools are held for as long as the
instance is, and the arithmetic is per instance.
