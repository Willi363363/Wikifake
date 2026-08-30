# Phase 10 — the cutover, in order

> Step 10.11, as a checklist. Every line is a human gesture: a dashboard, a DNS
> record, a repository setting. No commit performs any of it, and no workflow
> here holds a token that could.
>
> The pieces were spread across four documents — the deployment variables, the
> ruleset dance, the rollback, and 10.11's own paragraph. Reconstructing the
> order from four files **during** a cutover is how a step gets skipped, so it
> is assembled here once.

## Where this stands

The cutover was run, and **not in this order**. Step 7 was done before steps 5
and 6, neither of which was done at the time; step 6 was caught up on
2026-08-30, step 5 has not been. Read this before running anything below: most
of it has happened.

| Step | State |
|---|---|
| 1 — Render `autoDeploy` off | done (the service is suspended, so moot either way) |
| 2 — empty the required-checks list | done |
| 3 — merge the stack | done — `main` serves the rewrite |
| 4 — refill the list | done — the nine names, verified against the API |
| 5 — move the domain | ❌ **not done** — the public domain still points at Render, which is suspended, so it answers nothing. `wikifake.vercel.app` is what works |
| 6 — repoint the probe | ✅ **done 2026-08-30** — see below |
| 7 — suspend Render | done — `x-render-routing: suspend-by-user` |

**Step 6 cost something every day until it was done.** `WEB_DEPLOY_URL` was
never set, so the probe for the application users actually reach skipped itself
and reported success while checking nothing; `DEPLOY_URL` was never deleted, so
the probe for the suspended Python service ran, got no answer for forty attempts,
and failed on every push to `main`. Promotions #143, #145, #152 and #155 all
carry that red.

This file predicted it: *"deleting the two Render variables is what makes those
probe jobs skip cleanly instead of failing on every push against a suspended
service — and that noise is what would mask a real failure of the two that
matter."* The noise was there, and it was masking exactly what it said it would.

Both variables were set on 2026-08-30 and the probe was run by hand against
`main` to prove it rather than assume it: `Does the web app serve this commit?`
polled and matched `f6c53b9` on its first attempt, the realtime target likewise,
and the Render target skipped cleanly with `DEPLOY_URL` gone. Three green, and
only one of them a skip.

`STAGING_DEPLOY_URL` was never set in the first place, so there was nothing to
delete.

`phase-10-rollback.md` has the one nuance: `DEPLOY_URL` is also the rollback's
probe, so deleting it is a step of the rollback in reverse. That is an argument
for repointing it when the domain moves, not for leaving `main` red.

## Before anything: three preflight facts

| Check | Why it comes first |
|---|---|
| Every step of `phase-10-cutover.md` except 10.11 is ✅, and 10.10's dry run has been done — **this one was not satisfied: the cutover ran with the net untested** | The rollback net has to exist before the thing it catches |
| Vercel and Render are provisioned per `phase-09-deployment-setup.md`, and `NEXT_PUBLIC_SITE_URL` is set on **production only** | Without it the canonical link and the sitemap name whichever host answered |
| A Vercel preview plays a full multiplayer game against the deployed Render instance | This is 9.8's own exit criterion, and it is the last chance to find a wiring problem while production is untouched |

## 1 — Turn off Render's `autoDeploy`

Dashboard → the service → Settings → Auto-Deploy → off.

**First, and not third.** The merge deletes the `Dockerfile` Render builds
from, so an automatic deploy would fail on the still-live production and take it
down at the exact moment attention is elsewhere.

While you are there: `curl https://<render>/api/health` and **keep the `commit`
value**. `phase-10-rollback.md` needs it to confirm a woken service is the one
you meant to wake.

## 2 — Empty the ruleset's required-checks list

`main` **and** `staging`. Settings → Rules → Rulesets → *ruleset* → Require
status checks to pass.

Leave every other rule on: the pull-request requirement, the linear history,
the force-push block. The repository is briefly without a CI gate; it is not
briefly without a review gate.

Why this cannot be avoided, and why it is one window and not several, is
`phase-09-ruleset-rename.md`. The short version: the merge renames four check
contexts and deletes two, so the list the ruleset holds today describes a CI
that will not exist a minute after the merge — and a required context that never
reports does not fail, it stays pending for ever.

## 3 — Merge the stack

Bottom-first, each pull request into the one below it, starting at **#33** and
working up to whatever is on top — `gh pr list --state open` in ascending order
is the sequence. Squash per step, as `01-git-flow.md` says. Then `feat/rewrite-phase-1` → the umbrella
`willi363/refonte` as a merge commit, so the history keeps one commit per step
rather than one opaque block.

Then the two promotions, both merge commits: umbrella → `staging`, and
`staging` → `main`.

CI still runs on all of it and is still readable on every pull request.
Emptying the list in step 2 stopped it being *enforced*, for these merges only.

## 4 — Refill the required-checks list

From a run on `main`, so the autocomplete offers contexts that exist. The nine
names are in `phase-09-ruleset-rename.md`.

**Nine, not eleven.** `Frontend (legacy)` and `Backend (Python)` were deleted by
the merge you just made. Adding them would block every pull request in the
repository on a check that can never report.

Then open a throwaway pull request towards `staging` and confirm it goes green
with nothing stuck pending. That is the only way to find out a name was typed
wrong, and it costs a minute.

## 5 — Move the domain

1. Remove the custom domain from Render, or both providers claim it and one
   answers a certificate error.
2. Add it to the Vercel project; let the certificate issue before going on.
3. Set `NEXT_PUBLIC_REALTIME_URL` on Vercel production to the realtime service,
   `wss://…`, and redeploy so the literal is inlined — it is a
   `NEXT_PUBLIC_` variable, so it is baked at build time and a variable change
   alone does nothing.
4. Add the production origin to the realtime service's `REALTIME_ALLOWED_ORIGINS`. An origin the
   list does not name is refused **before** the upgrade, which fails closed —
   correctly, and invisibly, until somebody tries to play.

## 6 — Repoint the probe

Repository variables, Settings → Secrets and variables → Actions → Variables:

| Variable | Set to |
|---|---|
| `WEB_DEPLOY_URL` | the public domain |
| `REALTIME_DEPLOY_URL` | the realtime service on Render |
| `DEPLOY_URL`, `STAGING_DEPLOY_URL` | **delete them** |

Deleting the two Render variables is what makes those probe jobs skip cleanly
instead of failing on every push against a suspended service — and that noise
is what would mask a real failure of the two that matter.

## 7 — Suspend Render

Dashboard → the service → Suspend. **Suspend, never delete**: the image is the
rollback net, and deleting the service removes it at the precise moment it might
be needed.

## Done when

- `deploy-check` is green on `main` against the new production: the commit
  served by **both** services equals the merged SHA.
- A multiplayer game plays on the public domain.
- A throwaway pull request towards `staging` goes green with no check pending.

## If it goes wrong

`phase-10-rollback.md`, and read it before starting rather than during. Under
ten minutes, and nothing in it needs a build or a deploy. The one thing to have
ready is the `commit` value from step 1.

The judgement call it also records: a rollback is for "the new stack is serving
something broken and we do not yet know why". For a defect you have already
understood, fix forward — the new stack redeploys from a merge in minutes, and
waking a stack whose source is no longer in the tree costs more the second day
than the first.
