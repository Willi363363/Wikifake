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

The gate therefore sits in two places:

1. **Where the agents run.** `.claude/settings.json` denies them
   `gh pr merge`, `gh pr review`, `gh pr edit`, ruleset modification, and
   pushing to `main` or `staging`. This is not a convention: the call does not
   go through.
2. **In CI.** The `Revue humaine` job (a live check name, renamed in phase 9)
   fails as long as the PR does not carry the `revu` label, applied by hand
   after reading. An agent cannot grant it to itself, since `gh pr edit` is
   denied to it. The gesture is timestamped in the repository's log.

**What this does not cover:** a human who deliberately bypasses it, or an
agent launched outside this harness. The real enterprise answer is a distinct
identity for agents — machine account or GitHub App — and a mandatory
approval. The day the repository has more than one person, that is the first
setting to change: required approvals at 1, and the label gate becomes
redundant.

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
direct push, no force-push, no deletion, and these checks green:

`frontend`, `backend`, `Conformité de la PR`, `Revue humaine`,
`Analyse de secrets`.

The French names are live check contexts declared in the ruleset; they are
renamed in phase 9, ruleset updated in the same move.

**A required check that never reports blocks the merge forever.** Every time a
job name changes — and the rewrite will change them — the required-checks list
must be updated in the same move. This is written into the phase 9 file.

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
