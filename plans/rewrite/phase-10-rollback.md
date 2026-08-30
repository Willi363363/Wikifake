# Phase 10 — the rollback net

> Step 10.10. One page, because a procedure that needs two is a procedure
> nobody reads at the moment they need it. Read it **before** 10.11, not
> during.

## What the net is

At cutover, the Render service is **suspended, not deleted**. Its last image —
the Python stack as it ran before step 10.9 removed the source — stays intact
and can be woken. Deleting the service would remove the rollback at the exact
moment it might be needed, which is this step's whole pitfall.

The image is the net. The code is not: `backend/` and `frontend/` are gone from
the tree, and getting them back is a `git revert` of the merge — a separate,
slower move, needed only if the old stack has to be *changed* rather than
merely served.

## Before the cutover

Three things, all of them cheap, all of them worthless if done afterwards:

1. **Turn off Render's `autoDeploy`.** The merge deletes the `Dockerfile` it
   builds from, so an automatic deploy would fail on the still-live production
   and take it down. This is 10.11's first line, and it is first for this
   reason.
2. **Note the commit Render is serving.** `curl https://<render>/api/health`
   and keep the `commit` value. It is what tells you, later, that the woken
   service is the one you meant to wake, and it is what the dry run below
   asserts.
3. **Keep `DEPLOY_URL` set.** It probes Render. Repointing it is part of the
   cutover, not part of the preparation, so a rollback finds it where it was.

## The rollback, in order

Under ten minutes, and no step depends on anything the merge removed.

1. **Wake Render.** Dashboard → the service → Resume. Wait for
   `GET /api/health` to answer, and check `commit` equals the value noted
   above.
2. **Repoint the domain.** DNS back to Render, or in Render's own custom-domain
   panel if the record never moved. Remove the domain from Vercel first, or
   both providers claim it and one of them answers a certificate error.
   **Today this step is already true**: the domain never left Render, because
   runbook step 5 was not done.
3. **Restore the probe.** `DEPLOY_URL` back to the Render URL, so
   `deploy-check` stops failing against a service that no longer holds the
   domain and starts telling the truth again. **Also already true**, and for the
   same reason — which is why `main` currently shows a red probe on every push.
4. **Leave the realtime service running.** It costs little and holds no state
   that matters — the rooms are in Redis, and a room in flight is lost by the
   cutover either way. Stopping it is one more thing to undo when you roll
   forward again. (This said "Fly" until the realtime service was retargeted to
   Render's free tier; Fly was never used.)

That is the whole procedure. Nothing in it needs a build, a deploy or a code
change.

## What a rollback costs, stated in advance

This is the part that must be written down rather than discovered:

- **Accounts and history created after the cutover stay in Neon and become
  inaccessible.** The Python stack has no database — it never had one — so a
  player who signed up on the new stack cannot sign in on the old one, and
  their games are not in the history the old stack shows. The data is not lost;
  it is unreachable until the roll-forward. Nobody should be told it is gone.
- **Rooms in flight die.** Both directions. A cutover and a rollback each
  replace the process holding the sockets.
- **The article cache is not shared.** Render's cache is in the RAM of a
  process that has been asleep, so the first rounds after a wake pay the
  generation cost again — ten seconds each, which is the wait the cache exists
  to remove.
- **Flag reports written on the new stack are in Postgres**, and the old stack
  reads `complaints.jsonl` in its own ephemeral disk. Same shape of problem as
  the accounts: unreachable, not lost.

## The dry run

Written as three steps — note the commit, suspend, resume — for a service that
was still serving production. **It is no longer, and that changes the step in
two ways.**

Half of it is already proved. The service was suspended at the cutover and has
stayed suspended: `https://wikifake.onrender.com/api/health` answers `503` with
`x-render-routing: suspend-by-user`. "Suspend it, confirm the URL stops
answering" is a fact on record rather than an experiment to run.

The other half is the only part of this whole procedure that ever had doubt in
it: **whether a suspended free-tier Render service comes back with the same
image.** Everything else is DNS and an environment variable.

What is missing to run it is the step-1 value — the commit Render served — which
was to be captured at runbook step 1 and is not written down anywhere. Without
it, "the same image" has nothing to be compared against, so the check becomes
weaker: that it answers at all, and that its `commit` is a pre-cutover SHA rather
than one of `main`'s recent ones.

So the dry run reduces to:

1. Dashboard → the service → **Resume**. Wait for `GET /api/health` to answer.
2. Record the `commit` it returns **in this file** — that is the value the
   procedure has been missing, and capturing it is most of what this run buys.
3. Suspend it again.

**It no longer touches production.** Production is `wikifake.vercel.app`; this
service holds no traffic and no state — so the reason to do it outside playing
hours is gone, and with it the main excuse for not having done it. It is still a
human's gesture on a dashboard: no CI job and no agent here holds a token for it.

> **Status: not run.** Step 10.10 stays open until it has been, and until the
> commit from step 2 is written above.

## When to stop rolling back and fix forward instead

A rollback is for "the new stack is serving something broken and we do not yet
know why". It is the wrong tool for a defect you have already understood: the
new stack redeploys from a merge in minutes, and every guarantee it holds is
covered by the grid in `phase-10-contract-map.md`. Waking a stack whose source
is no longer in the tree costs more the second day than the first.
