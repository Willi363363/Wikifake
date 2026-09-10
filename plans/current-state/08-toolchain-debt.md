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

Both read `REDIS_URL`, and locally that is one instance. Measured since:
`redis-cli DBSIZE` reported **36 keys** left behind after a journey run, and
`FLUSHALL` made the same socket suite pass. The journeys leave rooms,
subscriptions and delayed jobs; the socket suite then opens its own rooms
against a database that is not empty. Nothing is corrupted
and nothing is wrong with either suite — they simply were not written to run
back to back against shared state.

CI never sees it: each job brings up its own services. A developer running both
in one sitting sees it, reads a red socket test, and goes looking in the wrong
file — which is the whole cost, and it is a real one.

The fixes are all cheap and none is obviously right: a distinct Redis database
index per suite (`REDIS_URL` already carries one), a flush between runs, or
prefixed keys. Choosing wants a moment's thought about which of the three the
socket service should tolerate in production, so it is recorded rather than
guessed at.

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

Found on 2026-09-06, on a worktree with a `.env.local` at its root and nothing
exported:

```
@wikifake/web:test:   Tests  942 passed | 101 skipped (1043)
@wikifake/db:test:    Tests   11 passed |  92 skipped (103)
Tasks: 9 successful, 9 total
```

Two hundred cases did not run and the command reported success. Exporting
`DATABASE_URL` and `REDIS_URL` by hand ran all 1,043.

**This is the defect #177 just closed, one command over.** The loader is wired
into the four entry points that read the environment before anything else —
`apps/web/next.config.ts`, `apps/realtime/src/main.ts`,
`packages/db/drizzle.config.ts`, `packages/db/scripts/seed.ts`. Vitest is a
fifth: the suites read `process.env.DATABASE_URL` at collection time and skip
themselves when it is absent, which is the behaviour that makes a run without a
database *usable* — and the same behaviour that makes a run without a **file**
indistinguishable from a real one.

Neither `apps/web/vitest.config.ts` nor `packages/db/vitest.config.ts` declares
`setupFiles`, so there is no seam where the loader could run today.

**The fix is small and it is not a step of anything yet:** a setup file
importing `@wikifake/env/load`, declared by every vitest config whose suites
need a service. It is a no-op in CI and in production, where there is no file
and the platform sets the environment — the same argument #168 made for the
loader itself.

**The rule to carry meanwhile:** read the `skipped` count. A real local run says
`0 skipped`, and the handovers have said so since 2026-08-30 precisely because
nothing enforces it.

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
