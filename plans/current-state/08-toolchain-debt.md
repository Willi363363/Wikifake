# Current state — toolchain debt

The third debt register, and the one about **the commands you run**: a check
that fires at the wrong moment, an environment a command does not read, a server
that is reused when you meant it to be rebuilt.

| Register | What goes in it |
|---|---|
| `05-known-debt.md` | defects and gaps with a `file:line` |
| `06-structural-debt.md` | the shape of the repository and its code |
| this file | the commands you run, and what they do not tell you |
| `09-query-debt.md` | query plans: what is slow, at what size |
| `10-test-debt.md` | **the suites themselves** — why a green run can be wrong |

These are not defects in the product and they are not the repository's shape.
They are the reasons a command can mislead you, and every one of them below was
found by being caught out by it — which is why they are written as symptoms
first and causes second. Same rule: recorded here, fixed in the step it belongs
to.

**The suites moved out on 2026-09-11**, at step J.9, when this file reached the
200-line rule with a finding still to write. What went to `10-test-debt.md` is
everything about the *runs*: the shared Redis, Vitest's unhandled errors, and
the pool that serialises a race. What stayed is everything about the *commands*
around them. A squeeze would have been the other answer, and it is the one that
loses a finding.


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
