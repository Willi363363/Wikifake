# Current state — toolchain debt

The third debt register, and the one about **the commands you run**: a suite
that passes for the wrong reason, a check that fires at the wrong moment, a
server that is reused when you meant it to be rebuilt.

| Register | What goes in it |
|---|---|
| `05-known-debt.md` | defects and gaps with a `file:line` |
| `06-structural-debt.md` | the shape of the repository and its code |
| this file | the commands you run, and what they do not tell you |

These are not defects in the product and they are not the repository's shape.
They are the reasons a green run can be wrong, and every one of them below was
found by being caught out by it — which is why they are written as symptoms
first and causes second. Same rule: recorded here, fixed in the step it belongs
to.

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

## A pull request title becomes a commit subject, and nothing checks it

Found by causing it, during the batch of 2026-08-28.

GitHub builds a squash commit's subject from the pull request **title** plus
` (#NNN)`, and `scripts/checks.sh commit-msg` refuses a subject over 72
characters. #125's title was 82, so the commit that landed on `staging` was 89.
The conformance job walks `git rev-list BASE..HEAD`, so the next
`staging` → `main` promotion failed on a commit that had already been merged.

**There is no clean way out once it has happened.** The commit is immutable
without a force-push to a protected branch; a later revert does not remove it
from the range; and weakening the check to go green is the one thing the rules
forbid outright. It costs either an amended force-push or an administrator's
bypass — both of which are exactly what the branch protection exists to prevent.

Structural rather than a defect, because the gap is in *where* the rule is
enforced. Every local hook and every CI job passes at the moment the mistake is
made. The title is the one input to a commit message that nothing validates, and
the bill arrives at a later promotion, in a pull request that did nothing wrong.

**The rule to carry meanwhile:** a title must be at most 72 minus the width of
` (#NNN)` — 65 characters in practice — whenever the merge will be a squash.

**The fix, unwritten:** the conformance job already has the pull request in its
event payload. Measuring `github.event.pull_request.title` on `opened`,
`edited` and `reopened` would refuse it before a commit exists, which is the only
moment it is still cheap.

## `pnpm test` does not read `.env.local`, and says so by passing

Found on 2026-09-06: a worktree with a `.env.local` and nothing exported ran
`942 passed | 101 skipped` in web and `11 passed | 92 skipped` in db, and
reported success. Two hundred cases did not run.

The suites read `DATABASE_URL` at collection time and skip when it is absent,
which is what makes a run without a database *usable* — and the same behaviour
that makes a run without a **file** indistinguishable from a real one.

**Fixed since, and kept fixed by a test.** Every vitest config whose suites read
the environment now declares `setupFiles: ['@wikifake/env/load']`, and
`packages/env/src/setup-files.test.ts` finds those packages by searching their
sources rather than their dependencies — so a new one that forgets fails. It is
a no-op in CI and in production, where there is no file and the platform sets
the environment.

The trap it leaves behind: that search reads **comments too**, so a file merely
mentioning the environment accessor makes its package look like one that needs
the setup file. `economy-seam.test.ts` hit it with a planted example.

**The rule to carry:** read the `skipped` count. A real local run says
`0 skipped`.

## `reuseExistingServer` reuses a server you started by hand

Found by causing it, on 2026-09-06, while probing track C's scene in a browser.

`apps/e2e/playwright.config.ts` sets `reuseExistingServer` whenever `CI` is
unset, so a web server already listening on 3100 is **used as it is**: the
config's build step and its whole `env` block are skipped, silently and with no
line in the output saying so.

Probing a page by hand means starting that server by hand, and a hand-started
one carries whatever its command line happened to set. Here it was missing
`NEXT_PUBLIC_REALTIME_URL`, so `multiplayer.spec.ts` and `room.spec.ts` both
failed on *"Players (2) not found"* — which reads as a socket regression, and is
a page that was never told where the socket is. Both passed the moment the stray
server was stopped.

**The expensive half is the other direction.** A hand-started server whose
missing variable happens not to matter gives a *green* run against a build the
config never made — and nothing in the report distinguishes that from a real
one.

**The rule to carry meanwhile:** stop any hand-started server before `pnpm e2e`.

**The fix, unwritten:** the web server's entry could be given a `url` that
carries the commit, or the config could refuse to reuse a server whose
`/api/health` does not report the working tree's `HEAD` — the deployment probe
already compares exactly that, for exactly this reason.

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
