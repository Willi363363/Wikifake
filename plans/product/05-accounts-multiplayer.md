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

### E.3b.2 — the player carries their account  ⬜

`createGame` still receives `guestName` and no `userId` for a room, so the rows
are complete and **unattributed**: `player_stats` counts a multiplayer round for
nobody. `results.test.ts` opens a round with an account directly and proves the
rest of the wire is connected, so what is left is only how the account gets
there.

It cannot come from the client as a claim — a browser that can say who it is can
say it is somebody else. The shape it wants is a **short-lived ticket the web
app signs**: `apps/web` reads the session server-side and mints one with
`BETTER_AUTH_SECRET`, the browser carries it on the socket URL, and
`apps/realtime` verifies it with the same secret it already has in its own
environment. Both halves need one module, and where that module lives — a fourth
shared package, or a server-only file in an existing one — is the decision that
step opens with.

**Nothing in E.4 or E.3b.1 changes when it lands**: `createGame` already takes
the `userId`, and the counters hang off it and `recordSubmission`.
