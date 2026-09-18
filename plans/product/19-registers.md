# Track R — four findings the registers measured, and nobody acted on

| | |
|---|---|
| **State** | 🔶 in progress — four steps |
| **Branch** | one per step |
| **Depends on** | nothing. Every step touches code that is already in `staging` |
| **Delivers** | a timeout that carries its own diagnosis, and three query fixes with a before-and-after each |

## Why this track exists

Tracks O, P and Q each emptied a register by fixing what a **review** found.
This one empties what the registers themselves had already written down and
left: `../current-state/09-query-debt.md` and `10-test-debt.md` between them
hold four findings that name a file, a line and — for three of them — a number.

They are together because they share a discipline rather than a subject:
**every one of them is finished by a measurement, not by an argument.**
`09-query-debt.md`'s own header says it — *a performance note without one is a
guess with a file name attached* — and the same rule is what makes R.1 a step
rather than a fourth raise of a ceiling.

## What the registers say, and what is still true in the code

### The timeout says what it wanted, never what it saw

`10-test-debt.md`, *The ceiling was raised, and then reached twice more*. Five
CI failures, three at a two-second deadline and two at eight, all of them the
same helper and the same sentence: *"timed out waiting for the lobby to hold
ada, bob"*, on branches that changed nothing the socket service reads.

The register's conclusion is the step, and it is explicit that the step is not a
number: *"a wait that misses eight seconds is a wait that is not happening — and
nothing in the failure says which frame never arrived, because the helper
reports what it wanted and not what it saw."*

`testing/client.ts:82` already has the lever. `what` is typed
`string | (() => string)` and the comment above the throw says why — *"described
lazily, so a failure can say what the state actually was"*.

**Seven of the 52 waits in `apps/realtime` use it, and the two that have failed
do not.** `broadcast.test.ts:107` and `reconnect.test.ts:159` pass a plain
string, so a run that fails says the roster never became `ada, bob` and does not
say whether it held `ada`, held nothing, or whether a single `lobby_update` ever
arrived — which is the difference between a slow instance and a subscription
that was never made.

The seven that do use it also show why the lever alone is not the fix: every one
glues what it saw onto the end of what it wanted, in one sentence, in four
different phrasings — *"3 round_started, got 1"*, *"both ready, saw […]"*. The
describer is there and the shape is not, so nothing makes a site that lacks one
look like it lacks one.

### The home reads a whole history to show four rows

`queries/history.ts:24` — `selectGameHistory` has no `limit`. `lobby/home.ts:132`
takes four with `.slice(0, RECENT_ROUNDS)`, in Node, after every participation
the player has ever had has crossed the wire. The predicate is
`participant.userId`, which an index covers; the order is `game.startedAt` on
the joined table, which none does.

**There is a trap in the obvious fix, and it is why this is a step.** The home
filters `endedAt !== null` *before* it slices (`home.ts:133`): a `limit(4)` in
SQL alone would hand back four rows that may all be unfinished, and the home
would draw an empty list for a player who has played. The predicate has to move
into the query with the limit, or the limit is a regression.

`exportAccount` (`queries/account.ts:322`) is the only other caller, wants all of
them and wants the unfinished ones too — which is exactly what an optional
parameter leaves it.

### The home's board is read before four reads that do not depend on it

`lobby/home.ts:101` awaits `readBoard` and only then opens the `Promise.all` on
line 111. Nothing in that group feeds the board and the board feeds none of
them; both take the same `viewerId` and the same `atMs`. One avoidable round
trip on every home page load.

The guest branch returns early on the board (line 107), so the change is not a
reordering of two lines: the call has to be started once and awaited in two
places, and a promise created before a branch is the shape track Q spent five
steps on. It must stay held on both paths.

### `DESC NULLS LAST` in an index does not serve `ORDER BY … DESC`

`09-query-debt.md`'s first entry, found in H.2 and measured there: on a ledger
of five thousand movements, `order by seq desc` cost 139 and 0.77 ms against
`desc nulls last`'s 0.35 and 0.08 ms — a sequential scan and a top-N sort
against an index scan that stops at the first row. The columns are `not null`,
so **the two orderings can never differ in result**, only in whether an index
may be used. Nothing catches it.

Two call sites were fixed where they were found and say so — `coins.ts:166` and
`admin-players.ts:142`. The register asks for the sweep the other side of it:
*"every `.desc()` in an index, against every query that orders on it"*.

Read out of the schema, four indexes are written `DESC NULLS LAST`:

| Index | Queries that order on it |
|---|---|
| `coin_movement_balance_idx` `(user_id, seq desc)` | `coins.ts:166` — ✅ already `desc nulls last` |
| `player_stats_finished_idx` `(games_finished desc)` | `admin-players.ts:142` — ✅ already |
| `coin_movement_user_idx` `(user_id, created_at desc)` | `coins.ts:254`, `account.ts:267` — bare `desc` |
| `leaderboard_mode_score_idx` `(mode, score desc, …)` | `leaderboard.ts:210`, `daily-board.ts:101` — bare `desc` |

**The register's 45 ms → 26 ms probe does not say which of the two leaderboard
orderings it changed**, and they are not the same query: line 210 is
`bestPerPlayer`'s `distinct on`, line 240 orders the subquery it produces, and a
subquery has no index at all. The step re-takes the measurement rather than
inheriting it.

## The decisions this track takes

### R.1 adds what was seen, and does not raise the ceiling

Eight seconds stays. The register is explicit that a third raise *"would only
move the number"*, and `client.ts:51` already carries C.7's argument for why a
threshold on a shared runner measures the runner.

What changes is the failure: it names the elapsed time and the state the
condition was looking at. The second argument grows a shape that carries both —
what was wanted, and a describer evaluated **only on failure**, so a wait that
succeeds pays nothing.

The bare-string form stays, because forty-odd waits are self-evident and a
mandatory describer on all of them is ceremony that would be filled in with
noise. The two `rosterOf` helpers are the ones that gain it, because they are
the ones that have failed; the seven ad-hoc describers move onto the same shape,
because two ways of saying one thing in one file is the duplication
`method/02-repository-rules.md` refuses.

### R.2 puts the filter in the query, not only the limit

For the reason above: a limit without the `endedAt is not null` predicate is a
home that goes blank for a player with an abandoned round. The step's test is
the one that fails without it — a player with five unfinished rounds and one
finished, and a home that still lists the finished one.

### R.4 measures each site, and reverts the ones that do not move

Four call sites, one clause each, and the finding is the before-and-after per
site rather than the change. Where the plan does not change, the site is left
alone and the register records that it was probed — a query fixed on the
strength of another query's number is the guess this register exists to refuse.

## Steps

| # | Step | State |
|---|---|---|
| R.1 | The timeout says what it saw, and how long it waited | ✅ |
| R.2 | The home's history stops at four, in the query | ✅ |
| R.3 | The board stops waiting its turn | ⬜ |
| R.4 | `desc nulls last`, swept and measured site by site | ⬜ |

**R.1** — `apps/realtime/src/testing/client.ts`, and the two `rosterOf` helpers
in `broadcast.test.ts` and `reconnect.test.ts`. The deadline is unchanged.

**R.2** — `packages/db/src/queries/history.ts` gains an optional limit and the
finished-only predicate; `apps/web/src/lobby/home.ts` stops slicing what it
already asked for. `exportAccount` keeps every row, and a test says so.

**R.3** — `apps/web/src/lobby/home.ts` only. The board joins the group, held on
both branches.

**R.4** — `leaderboard.ts`, `daily-board.ts`, `coins.ts`, `account.ts`, and
`09-query-debt.md` for the numbers.

## Exit gate

- **A test per step that fails without its fix**, checked by removing the fix
  rather than by assuming — tracks O, P and Q's gate, and the reason their
  repairs are believable.
- R.1 is proved by making a wait fail on purpose and reading the message: it
  names the roster that was held and the milliseconds that passed.
- R.2, R.3 and R.4 each carry a number taken on this machine, before and after,
  with the plan Postgres chose — the rule `09-query-debt.md` sets for itself.
- `09-query-debt.md` loses three entries and `10-test-debt.md` one, **in the
  pull request that closes each**, never afterwards.
- No step raises a timeout, and none changes a result: every ordering here is
  over `not null` columns, and R.2's limit is the only one that changes what a
  query returns — to a caller that was already discarding the rest in Node.
