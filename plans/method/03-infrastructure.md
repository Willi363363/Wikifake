# The infrastructure that holds the rules

The two previous files say how we work. This one says what mechanically keeps
that from drifting, and what remains the human's responsibility.

## Three environments, two deployed

| Branch | Environment | Render service | Probe |
|---|---|---|---|
| `staging` | pre-production | `wikifake-staging` | variable `STAGING_DEPLOY_URL` |
| `main` | production | `wikifake` | variable `DEPLOY_URL` |

A push to either one triggers `deploy-check.yml`, which polls `/api/health`
until the served commit is the one just pushed. Without a configured variable,
the job skips itself cleanly and explains how to set it up — a fork never sees
its CI fail over this.

**Why a pre-production:** without an environment behind it, `staging` is just a
ritual. Promoting to `main` then remains the same leap into the void as a
direct push. With a deployment and a probe, promotion becomes an informed
decision: we have seen the code run.

`render.yaml` describes both services, but **only takes effect if the service
is attached to a Render Blueprint**. As long as the configuration is done by
hand in the dashboard, this file documents what must be true without enforcing
it.

## The human gate

The problem, stated plainly: **with a single GitHub account, no server-side
control can tell a human from an agent.** Both carry the same token. Requiring
an approval achieves nothing — nobody can approve their own pull request, and
an agent that bypassed it would go undetected.

**There is no human gate any more.** It sat in two places and both are gone:

1. **Where the agents run.** `.claude/settings.json` used to deny `gh pr merge`,
   `gh pr review` and `gh pr edit`. Since 2026-08-30 it **allows** them —
   `02-repository-rules.md` carries the decision. It still denies ruleset
   modification, `gh label`, the `gh api` write verbs, and direct or forced
   pushes to `main` and `staging`, and those refusals are real: the call does not
   go through.
2. **In CI.** The `Human review` job still fails until a pull request carries the
   `revu` label — and an agent now applies it. The job is intact; what it
   attests is not. A label that whoever merges can grant themselves records that
   the pull request was ready, not that anybody read it.

So the honest statement, and the one to quote: **nothing in this repository
records that a human read a change before it merged.** Do not cite `revu` as
review, and do not read a green `Human review` as one.

What still holds is the second list above — an agent cannot alter the ruleset,
the labels, or the branches themselves. That is a boundary around
*configuration*, not around *code*: any change an agent can write, it can now
also merge.

### The owner bypasses the ruleset, and that is deliberate

This is the part that was missing here, and its absence made the rest read as a
stronger guarantee than it is.

The ruleset lists **one bypass actor — the repository owner — with
`bypass_mode: always`.** Required checks, the pull-request requirement and the
force-push block are all advisory for that account, on every branch the ruleset
covers.

It is not a leftover. With a single maintainer, a ruleset with no bypass makes
the repository unrecoverable by the only person who can recover it — the
promotion blocked by an already-merged commit, in `../current-state/06-structural-debt.md`,
is exactly the situation where the bypass is the way out. The cost is that it is
always on rather than reached for.

**What that costs, measured rather than supposed.** Pull requests #142 to #145
were all merged without the `revu` label, and #144 merged with `Human review`
reporting `failure`. The label never made anybody read anything; it only ever
recorded that somebody clicked. That measurement is what retired it on
2026-08-30 — a gesture demanded on every branch, buying nothing.

The consequence for agents is the one that matters. An agent carries the same
token as the account that bypasses everything, so **the deny list is the only
mechanism that stops it at all** — and it now stops only configuration:
the ruleset, the labels, the `gh api` write verbs, the branches. Code that an
agent can write, it can merge. `02-repository-rules.md` says what a deny list is
worth even there — a pattern blocks a spelling, not an action. The written rules
are the boundary. Nothing below them is a wall.

**The real answer, unchanged and now unavoidable:** a distinct identity for
agents — machine account or GitHub App — with required approvals at 1 and the
bypass actor removed. That was already the recommendation when a label gate stood
in front of it; the gate is gone, so it is the only proposal left rather than the
ambitious one. The day this repository has more than one person, it is the first
setting to change.

## Automated analysis

| Check | Tool | Scope |
|---|---|---|
| Secrets, hygiene, logging, docs | `scripts/checks.sh` | changed files |
| Secrets, known formats | gitleaks | PR history |
| Vulnerable or outdated dependencies | Dependabot | npm, pip, actions |

`scripts/checks.sh` is immediate and also runs locally; gitleaks knows token
formats and reads the history, not just the final content. The two complement
each other: the first catches what was just written, the second what we
thought had been removed.

Dependabot targets `staging`, never `main`: a dependency update follows the
same path as everything else.

## Required checks

The GitHub ruleset covers `main` and `staging`: pull request required, no
direct push, no force-push, no deletion, and these nine checks green:

`Is this run useful?`, `Lint & format`, `Typecheck`, `Test`, `Build`,
`Browser journeys`, `Does this PR follow the rules?`, `Human review`,
`Secret scan`.

Nine, and the two the old stack contributed — `Frontend (legacy)` and
`Backend (Python)` — are deliberately **not** among them: step 10.9 deleted the
jobs, and a required context whose job no longer exists never reports.

`Does <target> serve this commit?` is not there either, and never should be: the
probe runs after a merge, so requiring it on a pull request requires a check
that cannot report until the thing it checks has happened. Same for
`No direct push to main or staging`, which is a `push` job.

**A required check that never reports blocks the merge forever.** Every time a
job name changes, the required-checks list must be updated in the same move —
`../rewrite/phase-09-ruleset-rename.md` is the ordering that makes that
survivable, and it is worth rereading before renaming anything.

Modifying the ruleset is denied to agents. The command is:

```bash
gh api --method PUT /repos/<owner>/<repo>/rulesets/<id> --input ruleset.json
```

## What is still missing, deliberately

- No test coverage threshold: the new stack does not exist yet; it arrives
  with phase 0.
- No `CODEOWNERS`: with a single owner, it would be decorative.
- No static security analysis (CodeQL): to revisit once the TypeScript code
  exists.
