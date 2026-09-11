# The git flow

Two permanent branches, never touched directly:

- **`main`** — what is in production. Always deployable.
- **`staging`** — the integration branch. Everything passes through it before
  `main`.

Both are protected by a GitHub ruleset: pull request required, green CI
required, no direct push, no force-push, no deletion. The `pre-push` hook also
refuses locally, but the ruleset is what decides — for everyone except the
repository owner, who is a bypass actor on it. What that costs, and why it is
kept, is in `03-infrastructure.md`.

## The path of a change

```
  feat/<subject>  ──PR──►  staging  ──PR──►  main
       ▲                     │
       └───── update ────────┘
           before the merge
```

1. Create the branch from an up-to-date `staging`.
2. Do the step, commit, push.
3. **Update the branch from `staging`** — the step everyone skips and regrets.
4. Open the PR to `staging`. Green CI, then merge.
5. When `staging` is stable, a `staging` → `main` PR promotes the batch.

### The promotion is the one exception to the branch rule

Every other pull request has a `<type>/<subject>` head, and a protected branch
as a head means somebody committed where they should not have. The promotion is
the exception the rules know about: `scripts/checks.sh branch <head> <base>`
accepts `staging` — and only `staging` — when the base is `main`. Any other
protected head is still refused, and so is a push to one.

Without that pair, the conformance check refused the promotion for bearing the
name of the branch it is supposed to promote, and no batch could reach
production without the check being skipped rather than passed.

### A promotion is not only a merge: the migrations first

**Nothing in the deploy path runs a migration.** Vercel's `buildCommand` is
`turbo run build`, the web app's own build is `next build`, Render deploys a
container, and no workflow calls `pnpm migrate`. Checked, rather than assumed,
on 2026-09-11 — when fifteen migration *files* had accumulated between `main`
and `staging`, and the answer to "who applies them" turned out to be *a person,
by hand, as each one is written*.

**So ask the database what it has, never the branch.** `git diff main..staging`
over `packages/db/migrations/` says what `main` is missing and nothing at all
about production; the row count in `drizzle.__drizzle_migrations` is the
answer, and on 2026-09-11 it was already 21 of 21 while the files said fifteen
were outstanding.

So a promotion is three steps in this order, and the first is the one that gets
forgotten:

```bash
# 1 — the database first. Ask what it holds, then apply: drizzle-kit applies
#     what is missing and nothing else, so this is safe when nobody is sure.
psql "$DATABASE_URL" -c 'select count(*) from drizzle.__drizzle_migrations;'
DATABASE_URL='<the production one>' pnpm migrate

# 2 — the batch. `staging` is the one protected head the checks accept.
gh pr create --base main --head staging --title 'Promote staging: <what is in it>'

# 3 — after the merge, realign, which is a fast-forward since main descends
#     from staging.
git switch staging && git merge --ff-only origin/main && git push
```

**Code before schema is an outage**: the deployment answers on the new commit
within a minute of the merge, and a query against a table that does not exist
is a 500 on every screen that reads it. Schema before code is not, because
every migration this repository has written so far only adds.

A promotion also needs whatever environment variables the batch introduced —
they are listed in the step that introduced them, and a missing one fails at
startup by design (`@wikifake/env`) rather than halfway through a round.

### Why update before, not during

A conflict gets resolved properly on a working branch: you have the context,
you can run the tests, you can start over. The same conflict resolved in
GitHub's interface is resolved blind, without executing a single line, and
that is how code that does not compile gets merged. **The rule: `staging`
never sees a conflict.** When the PR opens, the merge is trivial.

```bash
git switch -c feat/<subject> origin/staging   # start from an up-to-date base

# … work, commits …

git fetch origin
git rebase origin/staging                     # replay on top of staging
# conflicts → resolve here, rerun the tests
pnpm check && pnpm test
git push --force-with-lease
gh pr create --base staging
```

`rebase` on a step branch: it is short, nobody builds on it, the history stays
linear. `--force-with-lease` and never `--force`.

## Big change: umbrella branch and phase branches

When a piece of work exceeds one step — a rewrite, a stack change, a UI
overhaul — it does not go into a single giant branch. An **umbrella branch**
carries the effort, one **branch per phase** carries the work:

```
  feat/rewrite-phase-1 ──┐
  feat/rewrite-phase-2 ──┼──►  feat/refonte  ──PR──►  staging  ──►  main
  feat/rewrite-phase-3 ──┘
```

- The umbrella (`feat/refonte`) starts from `staging` and only receives merges.
- Each phase (`feat/rewrite-phase-1`) starts from the umbrella, returns to it
  through a PR, and carries the number of the phase documented in
  `plans/rewrite/`.
- A phase updates itself from the umbrella before its PR — same rule.
- The umbrella updates itself from `staging` regularly — especially if other
  work is advancing in parallel.
- When enough phases are merged to form a coherent whole, a single PR
  `feat/refonte` → `staging`.

**The umbrella is never rebased.** Phase branches build on it: rewriting its
history breaks them all. `staging` is merged into it
(`git merge origin/staging`), never replayed.

## Merge method

| Merge | Method | Reason |
|---|---|---|
| step → umbrella or `staging` | **squash** | one step = one commit in the history |
| umbrella → `staging` | **merge commit** | keep one commit per step, not an opaque block |
| `staging` → `main` | **merge commit** | `staging` stays an ancestor of `main` |

After a promotion to `main`, `staging` realigns effortlessly, since `main`
descends from it:

```bash
git switch staging && git merge --ff-only origin/main && git push
```

## Naming

`<type>/<subject>`, lowercase, with a hyphen as word separator:

```
feat/refonte              feat/rewrite-phase-1
fix/reset-manche          docs/plans
refactor/scoring          ci/garde-staging
```

Types: `feat` `fix` `refactor` `perf` `docs` `test` `ci` `build` `chore`
`hotfix`. The CI check requires two lowercase segments; the list above is the
convention — hold to it.

## Emergency

A production fix starts from `main`, goes to `staging`, then is promoted. It
does not skip `staging`: a fix made in a hurry is precisely the one that needs
a pass through CI.

```bash
git switch -c hotfix/<subject> origin/main
# … fix + non-regression test …
gh pr create --base staging
```

## What we never do

- Push to `main` or `staging`. No exception, human or agent.
- Rewrite the history of a shared branch or an umbrella.
- Merge with a red CI, or by disabling a check.
- Resolve a conflict in the GitHub interface.
- Let a branch live more than a few days: it diverges, and the merge becomes a
  project of its own.
