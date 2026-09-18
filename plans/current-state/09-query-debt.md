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

Found in H.2, and it is the kind of defect that ships in silence. **`order by x
desc` means `desc nulls first` in SQL**, while Drizzle's `.desc()` writes
`DESC NULLS LAST` into an *index definition*. They do not match, so Postgres will
not use the index for the ordering. The columns are `not null`, so **the two can
never differ in result**, only in whether an index may be used, which is why
nothing catches it. H.2's own numbers — a scan and a top-N sort against an index
scan that stops at row one — are in `coins.ts`, beside the constant that spells
the order.

### The sweep, taken as R.4 — two sites moved, two did not

Four indexes are written `DESC NULLS LAST`; two of their queries already matched,
found by H.2 and by K. The rest were probed one at a time, and only the sites
whose plan changed were touched:

| Site | Before | After |
|---|---|---|
| `coins.ts` the ledger read | 3.3 ms, Bitmap Heap Scan + Sort | **1.5 ms**, Index Scan + Incremental Sort |
| `account.ts` the export | 1.2 ms, Bitmap Heap Scan + Sort | **0.5 ms**, Index Scan, no sort |
| `leaderboard.ts` all-time board | 26.5 ms | 26.5 ms — *left alone* |
| `daily-board.ts` the day's board | 6.3 ms | 6.3 ms — *left alone* |

The ledger's sort becomes *incremental* rather than disappearing: it also orders
on `seq`, which no index carries beside `created_at`. Neither board moved and
neither could — `daily-board.ts` filters on `game.daily_day` and never on the
entry's `mode`, and the next entry says why the ordering never cost the all-time
board anything.

## The all-time leaderboard reads the whole mode, because it needs a name

Moved here from `06-structural-debt.md`, where it was a pointer. Measured in G.4
at fifty thousand entries: the daily, weekly and regional boards
answer in 2–3 ms with their range pushed into an index; the all-time board took
45 ms, reading every entry in the mode, and measures **26.5 ms** since G.7.

**The scan is the cause** — not the index, and since G.7 not the sort either: a
board is one row per player now, so `distinct on` reduces twenty-five thousand
entries to two thousand before the ordering, and every entry is still read to
find each player's best. Its cost grows with the game's history where every
other board's grows with its period.

**The 19 ms this entry once charged to the ordering mismatch is not its.** R.4
re-probed all four spellings — inner, outer, both, neither — on the same seed:
26.5 to 27.1 ms, identical plans, identical again with `enable_seqscan` off.
Since G.7 the ordering *starts* with `user_id`, and no index starts there and
continues with `score`, so the whole of it belongs to the deduplication.

The two ways out, and why forcing a nested loop measures nothing, are in
`../product/07-leaderboards-queries.md`.

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

## The home reads a whole history to show four rows

`queries/history.ts:24` — `selectGameHistory` has **no `LIMIT`**. `lobby/home.ts:134`
takes what it wants with `.slice(0, RECENT_ROUNDS)`, in Node, after the rows
have crossed the wire.

Two costs, and the second is the one that grows. The rows are wasted, and the
**sort cannot use an index**: the predicate is `participant.userId`, which
`participant_user_id_idx` covers, but the order is `game.startedAt` on the
joined table. So Postgres fetches every participation a player has, joins, and
sorts — per home page load, for the players who play most.

The fix is a `limit` parameter rather than a second query. `exportAccount`
(`queries/account.ts:322`) is the only other caller and wants all of them,
which is exactly what an optional limit leaves it.

Found by reading, on 2026-09-17, and **not measured**: `09` usually carries a
timing beside a claim and this one has none, because the machine that would
produce it has four rounds in it. The shape is the finding; the number wants a
seeded history, the way `H.2` seeded five thousand movements.

## The home's board is read before the four reads it does not depend on

`lobby/home.ts:101` awaits `readBoard` and only then opens the `Promise.all` on
line 111. Nothing in that group feeds the board and the board feeds none of
them — they take the same `viewerId` and the same clock.

One avoidable round trip on every signed-in home page load, which is the same
arithmetic O.6 did for the session: not a slow query, a query waiting its turn
for no reason. Moving it into the group is the whole change.
