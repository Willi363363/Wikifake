# Phase 9.10 — Renaming the required checks

The rulesets of `main` and `staging` require a green CI **by check-context
name**. Renaming a job renames its context, and a required context that never
reports does not fail — it stays pending, forever. Every pull request in the
repository blocks until somebody fixes the ruleset.

This file is the ordering that avoids that. It is the half of step 9.10 a
commit cannot do: updating a ruleset is a repository-admin gesture in the
GitHub UI, and no workflow in this repository has, or should have, a token
that can perform it.

## The renames

| Old context (French) | New context |
|---|---|
| `Ce run est-il utile ?` | `Is this run useful?` |
| `Conformité de la PR` | `Does this PR follow the rules?` |
| `Revue humaine` | `Human review` |
| `Analyse de secrets` | `Secret scan` |
| `L'environnement sert-il ce commit ?` | `Does <target> serve this commit?` |
| `Aucun push direct sur main ni staging` | `No direct push to main or staging` |

The last two are not one-to-one. `deploy-check` became a matrix over three
targets, so it now produces three contexts rather than one — and none of them
belongs in the required checks: the probe runs **after** a merge, on `main`,
so requiring it on a pull request is requiring a check that cannot report
before the thing it checks has happened. It is dropped from the list rather
than renamed in it.

`No direct push to main or staging` is likewise `push`-only. It was already
detective rather than preventive — the ruleset itself is the prevention — and
it has no place among a pull request's required checks either.

## The ordering

The chicken-and-egg: a pull request carrying the rename runs the **new**
workflow, so it reports the new names, while the ruleset is still waiting for
the old ones. The rename cannot merge through its own gate.

Three steps, in this order, by an administrator:

1. **Empty the required-checks list** on the `main` and `staging` rulesets.
   Settings → Rules → Rulesets → *ruleset* → Require status checks to pass.
   Leave every other rule alone: the pull-request requirement, the linear
   history, the force-push block all stay on. The repository is briefly
   without a CI gate; it is not briefly without a review gate.

2. **Merge the phase-9 umbrella.** Its own CI runs and is readable on the PR —
   nothing about emptying the list stops the checks from running and being
   looked at. It stops them from being *enforced*, for one merge.

3. **Refill the list with the new names**, from a run on `main` so the
   autocomplete offers contexts that actually exist:

   - `Is this run useful?`
   - `Lint & format`
   - `Typecheck`
   - `Test`
   - `Build`
   - `Browser journeys`
   - `Frontend (legacy)` — until phase 10
   - `Backend (Python)` — until phase 10
   - `Does this PR follow the rules?`
   - `Human review`
   - `Secret scan`

Then open a throwaway pull request towards `staging` and confirm it goes green
with no check stuck pending. That is the step's "Done when", and it is the
only way to find out that a name was typed wrong.

## Why not avoid the window

The alternatives are worse. Bypassing the ruleset for one merge means giving
an account bypass rights and remembering to take them away. Keeping both the
old and the new names in the list blocks harder, not less: the old contexts
would never report at all.

Emptying the list is reversible in one gesture, visible in the ruleset's own
audit log, and lasts one merge.

## Phase 10

`Frontend (legacy)` and `Backend (Python)` leave with the code they test.
Removing them from the required checks is part of that step, not this one —
and it is the same three-step dance in reverse: drop them from the list first,
then delete the jobs.
