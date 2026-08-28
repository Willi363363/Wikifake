# Current state — known debt

**This file is the debt register.** Any problem discovered along the way —
during a review, a debugging session, a step that trips over something out of
its scope — is recorded here with its `file:line` reference, **without fixing
it** in passing: the fix happens in the step it belongs to, not as an aside.

The register was long. It is short now, and that is the rewrite's result rather
than an oversight.

## The fourteen defects the rewrite closed

D1 to D14 were the verified defects of the Python and Vite stack: the items
feature that threw on any round with items, penalties leaking between rounds,
two divergent start paths announcing two shapes of `players`, a round the
server never ended, a reconnection path that was dead code, unvalidated and
unthrottled `live_score`, `FREEZE_TIME` doing none of what it announced, the
scoring scale in three places, and a cache that did not do what its own
contract said in four separate ways.

They are **not repeated here**, deliberately. They live in section D of
`../rewrite/01-contract-to-preserve.md`, each with the file and line it was
verified at and the step that closed it, and every one of them is now held shut
by a named test in `../rewrite/phase-10-contract-map.md`. Copying the list into
this file would be a second place to keep it, which is the habit the rewrite
exists to break.

## Fixed on discovery: the socket never opened after "Open a room"

Not carried, because it was found by the step that had to pass with it fixed —
recorded here because it is the clearest argument in the register for what a
browser test is for.

`RoomGate` lives in the layout of the `(game)` route group so that it survives
the navigation from the entry screen into a room, which is the whole point of
step 7.1. It therefore **mounts before the nickname exists**, and its
`useEffect(..., [])` read `sessionStorage` once, then never again. The nickname
the entry screen writes on its way out was never read, so `RealtimeProvider`
stayed idle on a `playerName` of null — **for the whole life of the room**. No
roster, no chat, no round: nothing any other player did was ever seen.

It survived every unit suite because every one of them passes the nickname in
as a prop. `RoomGate` is the one piece that reads it, and the one piece nothing
was rendering. Step 9.5's first browser run found it in a minute; the effect is
now keyed on the room code, and `realtime/room-gate.test.tsx` locks it at the
cheap level too.

## A green test run can be an incomplete one

Roughly 250 of the suite's cases — the database queries, the Redis cache, the
socket service, the round journeys — **skip** when Postgres and Redis are
absent, rather than failing. `pnpm test` then prints a green summary that looks
exactly like a complete run, and a claim made from it about the contract would
be false.

CI runs both as services, so CI is never in that state. A developer is, by
default, on a fresh clone. The output says `0 skipped` when the run was real,
and that is the line to read before believing a green one.

**Not a defect to fix so much as one to know**: making the suites fail without
the services would make a fresh clone unable to run any test at all, which is
worse. What is missing is a louder signal — a summary line that says how many
skipped and why. Its own step, when somebody is annoyed enough.

## `plans/current-state/` is no longer mechanically checked

`test_architecture_doc.py` verified this directory against the code with
regexes: the cited modules existed, the `make` targets existed, the documented
messages equalled the dispatch table, the documented routes equalled the route
decorators. It was deleted with the Python at step 10.9, and C8.2 anticipated
exactly this — a guarantee that dies with its subject disappears without a
sound.

What replaced it covers the *protocol* and the *routes*, which is most of what
that test checked, and covers them better:

- `packages/protocol/src/docs/docs.test.ts` — `plans/protocol/` is generated
  from the schemas, and a divergence fails `pnpm test`.
- `apps/web/src/route-parity.test.ts` — the REST catalogue equals the routes
  that exist.
- `apps/realtime/src/catalogue-parity.test.ts` — every documented outbound
  message is actually sent.

What is **not** replaced: the prose of this directory. The module tables in
`01-packages.md`, `02-web.md` and `03-realtime.md` name files, and nothing
fails when one is renamed. That is the one place in the repository where
documentation can now drift silently, and it is worth a small test — every
backticked path in `current-state/` exists — which is cheap and which nobody
has written.

## `/gallery` ships to production

`apps/web/app/gallery/page.tsx` is the design-system audit of phase 6: every
component, rendered, with its tokens and its contrast grades. It is a
development surface, and it is in the production build as a static route — the
build output lists it. Anybody who guesses the URL reaches it.

Nothing leaks: it renders components, not game state. Step 10.0 added it to the
`robots.txt` disallow list so it is not indexed. But "not indexed" is not "not
served", and the honest fix is either a `NODE_ENV` guard or a move behind auth.
Not decided, so recorded.

## A skipped run satisfies a required check

Found while promoting the rewrite to `main`, and it is why that promotion
merged on a check that never ran.

`rules.yml`'s conformance job carries
`if: ... contains(['opened','synchronize','reopened'], github.event.action)`, so
a `labeled` event skips it — deliberately, to avoid burning CI minutes and
cancelling an in-flight run through the concurrency group. But **GitHub treats a
skipped required check as satisfied**, and the skipped run is the one the branch
protection reads. So applying the `revu` label produced a green gate over a
check that had failed on the previous run.

The immediate cause is fixed: the promotion now passes the branch rule
legitimately rather than failing it. The general shape is not — any required
check whose job is conditional can be turned green by an event that skips it.

Two ways out, neither free: drop the action filter and pay the CI minutes, or
give the job a no-op `else` branch that reports success only when it has
genuinely re-read the rules. Not decided, so recorded.

## The two services disagree about the version

`/api/health` exposes `version` on both, and they do not match: `apps/web`
answers `1.1.0`, `apps/realtime` answers `0.1.0`. Each reads its own
`package.json`, and nothing asserts they agree — the parity test that existed
compared `apps/web` to `backend/src/version.py` and left with the Python at step
10.9.

C7.2 is satisfied either way: it asks for the field, and the CI probe compares
`commit`, not `version`. But two services deployed from one commit answering
different versions is a wart, and somebody comparing the two probes will lose
time over it.

The fix needs a decision this note will not make: one version for the
repository, or a version per deployable with a test that says so on purpose.
Found while pre-flighting the Fly image, out of that step's scope, recorded.

## Round timers do not survive a restart on the free Redis

`main.ts` chose BullMQ delayed jobs over in-process timeouts for a stated
reason: *"a timeout dies with its process, and a redeployment would forget every
round in flight"*. The socket service now runs on Render's free tier, whose Key
Value instance **has no persistence**, so a redeployment forgets them anyway.

The guarantee is not lost in the abstract — the code is still correct, and a
persisted Redis restores it by changing one connection string. It is lost on this
plan, which is the plan the project can afford. Recorded because the reasoning in
`main.ts` now overstates what the deployment delivers, and somebody reading that
comment would believe a round in flight is safe across a deploy.

What it costs in practice: a deploy during a live round leaves that round without
its end-of-round alarm. `ROOM_IDLE_LIMIT_SECONDS` still reaps the room after an
hour, so nothing leaks — the players just see a round that never ends.

## There is no socket heartbeat, and the host sleeps

`ROOM_IDLE_LIMIT_SECONDS` lets a room live an hour with nothing happening in it.
Render's free tier spins the service down after **fifteen minutes** without
inbound traffic. Nothing on the socket fills that gap: `/ping` is an HTTP route
for the platform's health check, not a client heartbeat.

So a room whose players are idle in a lobby loses its sockets, and gets them back
about a minute later when someone acts. `REALTIME_GRACE_SECONDS = 90` is what
stops that costing anybody their seat, and the client's one-second retry loop is
what reconnects. It works, and it is a workaround for a missing message.

The honest fix is a client heartbeat — which means a new message in
`packages/protocol`, regenerated `plans/protocol/` pages, and a snapshot test to
update. That is its own step, not an aside in a deployment change, so it is
recorded here rather than smuggled in.

## The structural debt is its own file

The entries above are defects and gaps with a location. The notes that are
about the *shape* of the repository — a bundler we cannot use yet, two
notations for one contract — are in `06-structural-debt.md`, because this file
once reached the 200-line limit and squeezing a document is how it stops being
read.

A finding recorded on the way through goes in whichever of the two it belongs
to. Both are the debt register.
