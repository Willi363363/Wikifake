# Current state — test debt

The fifth debt register, and the one about **the suites themselves**: why a
green run can be wrong, and why a red one can mean nothing.

| Register | What goes in it |
|---|---|
| `05-known-debt.md` | defects and gaps with a `file:line` |
| `06-structural-debt.md` | the shape of the repository and its code |
| `08-toolchain-debt.md` | the commands you run, and what they do not tell you |
| `09-query-debt.md` | query plans: what is slow, at what size |
| this file | the suites: what a run is worth, and when it is worth nothing |

It was split out of `08-toolchain-debt.md` at step J.9, which is the moment that
file reached the 200-line rule with a finding still to write. The entries are
unchanged; only their address is.

Every one of them was found by being caught out by a run, so each is written as
a symptom first and a cause second. Same rule as the other four: recorded here,
fixed in the step it belongs to.

## `pnpm e2e` and `pnpm test` share one Redis, and the second one loses

Found by causing it: an e2e run followed immediately by `pnpm test` failed
`apps/realtime/src/broadcast.test.ts` — *"timed out waiting for the lobby to hold
ada, bob"* — and the same suite passed on its own a minute later.

Both read `REDIS_URL`, and locally that is one instance: `redis-cli DBSIZE`
reported **36 keys** left behind after a journey run, and `FLUSHALL` made the
same socket suite pass. Nothing is wrong with either suite — they were not
written to run back to back against shared state, and a developer running both
reads a red socket test and looks in the wrong file. CI has seen it too: run
34475187062 failed on #205, a change touching no realtime code.

**The cause is not a loaded runner, which is what this entry said next.**
Measured during G.2, on this machine:

```
turbo run test --force                  realtime: 1 failed, 140 passed   (twice,
                                        different victims each time)
turbo run test --force --concurrency=1  10 tasks successful, 141 passed
```

**Three packages read `REDIS_URL` and turbo runs their suites in parallel** —
`@wikifake/article` and `apps/web` for the article cache, `apps/realtime` for
rooms. So a single `pnpm test` races itself: the socket suite opens rooms while
another suite is writing and flushing the same instance. Sequentially every
suite passes.

**`pnpm test` is the command CI runs**, so any pull request can go red for it —
#205 did. And a developer who reruns the failing package alone sees it pass,
which reads as "flaky test" rather than "shared state".

### There were two races here, and one of them is fixed

**Within `apps/realtime`, its own files raced each other**, and that half is
closed. `vitest.config.ts` said *"ports are picked by the OS, so files may run
in parallel"* — true when a port was the only shared resource. Steps 5.8 and
E.3b.1 gave two of those files one scratch database, and every file shares one
Redis, so the suite raced itself with no other package running: forcing
`--fileParallelism` under load reproduced `broadcast.test.ts` failing, and CI
reproduced the database half twice on #218 — `generation.test.ts` losing the
room its round references, and a different `results.test.ts` case each run.

The fix is the line `apps/web` and `@wikifake/db` already carry:
`fileParallelism: false`. Eight runs under the load that had produced a failure
were green. It costs a slower realtime suite.

**Across packages, one Redis is still shared**, and that half is open: turbo
runs the three suites that read `REDIS_URL` at once, so `pnpm test` can still
race itself however serial each suite is internally. `--concurrency=1` is the
diagnosis, not the fix. A distinct database index per package is the obvious
candidate, since `REDIS_URL` already carries one; a flush between runs and
prefixed keys are the others. Choosing wants a moment's thought about which the
socket service should tolerate in production, so it stays recorded.

## A green suite and a failing job: Vitest's unhandled errors

**Vitest exits non-zero on an unhandled error even when every test passed.**
Right — an error nobody caught can make a passing test meaningless — and the
least legible way to be told, because the reflex on a red job is to look for a
failing case and there is none. Read the `Errors` line under the `Tests` line.

Found on 2026-09-11: `1530 passed`, `1 error`, `ReferenceError: window is not
defined … caught after test environment was torn down`. The cause was H.6's
`useOutfit` continuing after unmount — aborting a fetch is necessary and not
sufficient, since the gap between a response resolving and the code acting on
it honours no signal. Fixed there.

**The shape is what stays recorded, not that bug**: any async work a component
starts can outlive the environment, and it is load-dependent — the same commit
passed locally and on a re-run.

Seen again on 2026-09-11, on J.9's pull request — a diff of page metadata and a
list — as `1736 passed, 1 error`. Same reference, different owner: this time the
timer belonged to **`better-auth`**, whose `cleanupBroadcastSetup` runs from a
`nanostores` lifecycle timeout about a second after the last subscriber goes
away, and touches `window` when it does. It is a library's own teardown rather
than ours, so there is nothing in this repository to cancel; the job was re-run
and passed. Worth knowing before somebody spends an afternoon looking for the
component that leaked.

## `openTestDatabase` serialises the transactions a test meant to race

`packages/db/src/testing/database.ts:49` opens the pool with `max: 1`, for a good
reason it states: a transaction left open then hangs the test that leaked it,
rather than failing an unrelated test later.

The cost is that **two transactions started with `Promise.all` on `store.db` do
not overlap at all** — the pool hands the connection to the second only when the
first has finished. So a test written to prove that a write survives contention
proves only that the same call made twice returns the right thing.

Found by mutation while writing F.6. `claimQuest` is a single conditional update
(`… where id = $1 and user_id = $2 and claimed_at is null`), and rewriting it as
a check followed by an unconditional write — the version a retry can pay a
reward twice — **passed the entire suite**, including two cases with
"concurrently" in their names.

Two things follow, and the second is the one to act on:

- **`profile.test.ts:144` carries the same overstatement.** "Both issued before
  either has committed, which is exactly the case a read-then-insert cannot
  refuse" is not what that test does. E.3.1's guarantee is not in danger — the
  claim is an insert against a unique index, and the case at line 165 holds it
  from the schema's side — but the comment describes a race that did not happen.
- **A test that needs real contention must open its own connection.**
  `connect({ url, max: 1 })` a second time and let the two contend;
  `quests.test.ts` does it that way now. And where the property is a *predicate*
  rather than an outcome, read the SQL: `claimStatement(...).toSQL()`, the way
  `game.test.ts` reads C1.1 off the query rather than racing for it.
