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

They are **not repeated here**, deliberately: they live in section D of
`../rewrite/01-contract-to-preserve.md` with the file and line each was verified
at, and every one is held shut by a named test in
`../rewrite/phase-10-contract-map.md`. A second copy is the habit the rewrite
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

**It bit the same file again on 2026-09-17.** P.3 found that the same effect,
keyed on the room code *alone*, never asked again when there was no nickname at
all — and P.3's first implementation then flashed a prompt at players who had
one, caught by the case 9.5 left behind. Two defects and a near-miss in one
`useEffect`.

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

`test_architecture_doc.py` checked this directory against the code with regexes:
cited modules, `make` targets, documented messages against the dispatch table,
documented routes against the decorators. It went with the Python at step 10.9,
and C8.2 anticipated exactly this — a guarantee that dies with its subject
disappears without a sound.

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
## What the free tier costs moved out

**On 2026-09-17**, to `04-deployment.md`: *Round timers do not survive a
restart on the free Redis* and *There is no socket heartbeat, and the host
sleeps*. Neither is a defect with a `file:line`, both are consequences of a
hosting plan, and the second had just been read too late by a step that changed
the client's retry loop (track Q, Q.1).

## Half of the server's refusals are still in the server's language

**Rewritten on 2026-09-17**: the entry described one defect, there were two,
and the one it named by file is the one that got fixed. Step 11.9 settled the
question it left open — *the server authors codes, the client authors
sentences* — and `realtime/refusal.ts` does it. The **socket** path took it:
`lobby/room.tsx:64` translates `room.refusal?.code`, so `round.tsx` renders
catalogue prose.

**The REST path did not.** `solo/solo.tsx:89`, `:155` and `:175` all do
`setRefusal(answered.message)` — the server's English under a French interface,
and line 115's comment says so: *"shown as received."*

Nothing is missing, which is what makes it cheap: `restError.code` is the same
`errorCode` enum `useRefusal()` translates (`protocol/src/errors.ts:182`) and
`solo/api.ts` already carries it back. The screen has the code and prefers the
sentence.

## The register is six files

The entries above are defects and gaps with a `file:line`; the table at the top
names the five neighbours that hold the rest. Each of them exists because the
file a finding belonged in had reached 200 lines while the finding was still
being written — H.2, then J.9, then this file, and twice again on 2026-09-17.
Splitting rather than squeezing is the rule.

## Two routes call a paid model, and nothing limits who

`game/start.ts` and `game/flags.ts:63` both reach a language model and neither
asks who is calling: `handleStart` mints a guest through `identify()`, and
`handleFlagReport` accepts `session?.user.id ?? null`. So there is no account
to refuse in one and no account at all in the other.

Nothing bounds the spend either: the cache is keyed on the topic, so a caller
sending a different one each time misses every time — `MAX_CATEGORIES` bounds
its memory, not the bill — and there is no per-player or per-IP counter, nor a
firewall or BotID in `vercel.json`. **Track K measures what the model costs and
nothing caps it**, which shows up on an invoice rather than on a screen. Beside
it: `flag-report/route.ts` is the one model-calling route with no
`maxDuration`, where the other three cap at 60. Recorded rather than fixed,
because a limit is a policy — who may have how much, and what a refused player
is shown.

## The chat rail sits on the room card at 360 px

`chat/chat.tsx:106` pins the closed handle to `right-0`, and the waiting room's
card reaches within a dozen pixels of that edge on a phone, so the handle covers
its border. Nothing is hidden and nothing is unreachable: this is a placement
decision for the rail rather than a width to shave, and it is its own step.
