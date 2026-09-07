# Track E — the step the list did not have

The record of **E.3b**, split off from `05-accounts-steps.md` when that file
reached the line cap. It is the longest of track E's records and the least about
accounts: it is about a transport that created rows and never wrote to them.

`05-accounts.md` keeps the step table — the only place that says where a step
stands.

## E.3b — the step this list did not have, and why it needs one

**Found while building E.4, by reading the write paths rather than assuming
them.** A multiplayer round never reaches Postgres as a result:

- `apps/realtime/src/generation.ts` calls `createGame` with
  `players: [{ guestName, colour }]` and **no `userId`** — its own comment says
  "a nickname, not an account";
- nothing in `apps/realtime` calls `recordSubmission`, or writes `participant`
  at all after the game is created. The round lives in Redis and the scores are
  broadcast.

So `participant.submitted_at` and `participant.score` are written by the solo
path and by nothing else, and a multiplayer game is a row that was started and
never finished by anybody.

**That is E.4's exit gate, not a detail.** "The profile shows real numbers"
cannot be true of a player who plays in rooms, and no amount of care in the
aggregate fixes it: the data is not there. The list was cut before anybody had
read those two files, which `../method/00-dev-cycle.md` names as the second of
its three overflow cases — *the step was badly cut; rewrite the steps, then
resume.*

It is numbered **E.3b** rather than by renumbering everything after it: E.4 is
already done, and moving a finished step's number would break every reference
to it, in this repository and in four pull requests. The letter says what it is
— a step that was missing rather than one that was planned.

**It turned out to be two steps, and building the first is what showed it.**
Writing the results down and knowing whose they are are separate problems with
separate mechanisms, and only the second needs a secret.

### E.3b.1 — the results are written  ✅

`createGame` has always returned a `game` row and a `participant` row per
player, and `generation.ts` has always thrown both away. So they ride into the
room on `article_ready`, sit on the round as a `RoundRecord`, and come back out
of `endRound` as a **`record_results` effect** — the rules deciding what the
round came to, the service carrying it out, which is how every other consequence
in this reducer works.

Four decisions, each of which a guard in this repository forced or confirmed:

- **The effect carries no clock.** `purity.test.ts` holds these rules to reading
  none, and it is right: the rules decide *what* a round came to, and *when it
  was written down* is the writer's instant. The solo path already stamps it
  that way, from an injected `now`.
- **A player who never submitted is absent, not present with a zero.** The
  leaderboard shows them a zero and that is a display rule (C2.4);
  `participant_score_with_submission` forbids a score without a submission, and
  writing it down would turn *did not answer* into *answered and scored
  nothing* — which a profile would then count as a finished round.
- **The write happens on the instance that applied the event**, beside
  `generate_article`, and not in `publish`. An effect put on the channel reaches
  **every** instance holding a socket for that room, so a write done there would
  be done once per instance.
- **The marks travel with the score.** They were graded and discarded, which is
  why the `answer` table has never held a multiplayer row: a debrief could say a
  player scored 420 and nothing anywhere could say what they marked to earn it.

`recordResults` is a **required** port on `ServiceOptions`, like `closeRoom` and
for the same reason: an optional one is a deployment quietly recording nothing,
which is the state this step exists to leave.

### E.3b.2 — the player carries their account  ✅

A browser cannot be asked who it is: one that can say so can say it is somebody
else. So the web application — the only thing that can read a session — signs a
short statement, the browser carries it on the socket URL, and the realtime
service checks it with the secret both halves already load.

**`@wikifake/tickets`, its own package, and that was the decision this step
opened with.** It could have lived in `@wikifake/protocol`, which is where the
shapes two sides agree on live, and the argument against it is one import: it
needs `node:crypto`, and `protocol` is bundled into a browser. A subpath export
would have kept it out today and been one careless import from a build failure
naming `crypto` and nothing else. A package the browser has no reason to depend
on cannot be imported into one by accident, and `workspace-graph.test.ts` is
where that boundary is now visible. It depends on nothing at all.

**What a stolen ticket is worth, stated rather than assumed.** It carries no
session and grants no access: presenting one lets a socket say *this round is
mine*. It is bound to a room **and** to a nickname, and that nickname is already
defended by D5's own token — so using a stolen one means holding both secrets
and joining the same room under the same name, at which point the theft has
bought the ability to play a round on somebody's statistics. Ten minutes on top
of that, because there is no reason for it not to be.

**Every failure is the same answer: no ticket, round unattributed.** A bad
signature, a stale one, a fetch that failed, a deployment whose halves disagree
— all of them play the round exactly as every multiplayer round played before
E.3b. A player kept out of a room because a statistics counter could not be
credited would be the worst trade in the step.

**The ticket route creates a guest**, through the same `identify` the solo route
uses, and that is not a convenience: 4.3's whole design is that a guest holds a
real anonymous `user` row so their rounds follow them into an account created
later. A room player never given one is a round that can never be attached.
Multiplayer catching up with solo, five phases later.

**It is resolved in `RoomGate`, not in the provider**, and the first attempt had
it the other way. Fetching inside `RealtimeProvider` made opening a socket
asynchronous and broke **95 tests** across every suite that mounts it — a cost
paid for ever, in every future test, for a fetch that belongs one level up. The
gate already waits for a nickname before letting a connection start; one more
thing to wait for belongs beside the first, and the two are one piece of state
so the provider can never see a nickname without its ticket.

**The account is not replaced on a reclaim.** Whoever reconnects into a slot is,
by D5's token, the player who left it — and a reclaim that rewrote it would be a
way to move somebody else's round onto your own statistics by holding one secret
rather than two. It survives `forNewRound` for a simpler reason: it is who the
slot *is*, not what it did last round.

**The rules never check a signature.** `join` carries a `userId` that the
transport has already decided; a reducer that verified a ticket could not be
replayed without the secret, and `purity.test.ts` would be right to say so.
