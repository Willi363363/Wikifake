# Track E — accounts and player statistics

| | |
|---|---|
| **State** | 🔶 E.1 guarded and documented, awaiting credentials |
| **Branch** | `feat/player-accounts` |
| **Depends on** | — |
| **Delivers** | sign-in that works in production, a profile, and per-player stats |

## Objective

Turn the authentication the rewrite already built into something a player
actually uses: a way in, a pseudonym, and a record of how they have played.

## What exists, checked in the code

**Almost all of it.** `apps/web/src/auth/auth.ts` runs `better-auth`, and
`apps/web/src/auth/providers.ts` offers Google and GitHub, each enabled by the
presence of its credential pair — with a deliberate throw when one half is set
and the other is not. The schema carries `user`, `profile` and the session
tables, and a guest's game already follows them into their account.

**So "add Google login" is a deployment task, not a development one.** It
needs `GOOGLE_OAUTH_CLIENT_ID` and `GOOGLE_OAUTH_CLIENT_SECRET` in the Vercel
environment, and the redirect URI registered in the Google console. Zero lines.

**E.1 is ⚠️ rather than ✅ for two reasons, both in `05-accounts-oauth.md`.** The
credentials are a person's to create. And the step's exit line — sign in with
Google, from a phone — needs a button, which is E.2: `better-auth`'s social flow
is a `POST`, not a URL anybody can paste. What E.1 did ship is the guard on the
variable those credentials depend on, `BETTER_AUTH_URL`, whose localhost default
would otherwise send every player who signs in to their own machine, silently.

## The data we ask for, and the reason it is this little

Email, password, pseudonym. Nothing else — no real name, no birth date, no
avatar upload, no address.

**Be straight about what this does and does not buy.** It does not put the
project outside the GDPR: an email address is personal data, an account is
processing, and a European user has rights over both regardless of how little
is stored. What it buys is that compliance stays *small* — a privacy policy, a
retention period, an export and a delete. Those four are track J's, and they
are cheap only because this track kept the field list short. Every field added
here makes them more expensive, which is the argument for adding none.

The pseudonym is what other players see. The email never appears in a room, a
leaderboard or a shared score.

## Steps

| # | Step | State |
|---|---|---|
| E.1 | OAuth credentials in the environments, Google first | ⚠️ |
| E.2 | Sign-in and sign-up screens, on the direction | ⬜ |
| E.3 | Pseudonym: chosen, unique, and the only public identifier | ⬜ |
| E.3b | Multiplayer results reach the database | ⬜ |
| E.4 | `player_stats` — the aggregate a profile reads | ✅ |
| E.5 | The profile screen | ⬜ |
| E.6 | Guest continuity — a guest game survives signing up | ⬜ |
| E.7 | Export and delete my account | ⬜ |

### E.3b — the step this list did not have, and why it needs one

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

What it involves, so that whoever takes it knows the shape: the socket player's
account has to reach the service (a protocol field, so regenerated
`plans/protocol/` pages and a snapshot to update), and the round's end has to
write through `recordSubmission` rather than only broadcasting. **Nothing in
E.4 changes when it lands** — the counters hang off `createGame` and
`recordSubmission`, so the day multiplayer goes through them the numbers
follow.

### E.4 — What a statistic is

Aggregate rows, written when a round ends, never recomputed from scratch on
page load:

- games played, finished, abandoned
- falsifications found, missed, and paragraphs wrongly marked
- best score, average score, current and best streak
- first seen, last seen

Two of those — last seen and finished-versus-started — are what the admin
panel's activation KPI reads in track I, so they are named here and not
invented twice.

**Three of them are not columns.** *Abandoned* is played minus finished,
*average* is the total over the finished count, and *accuracy* is found over
found plus missed. A stored column that can disagree with its own inputs is a
bug with a schema, so `queries/stats.ts` derives all three on the way out and
`player_stats` holds only what cannot be derived.

**"Current and best streak" did not say a streak of what**, and the plan is the
place that decides. It is **consecutive perfect rounds** — every falsification
found *and* nothing true marked — and it lives as one predicate,
`isPerfectRound` in `@wikifake/domain`, so that overturning this is one function
and a recomputation rather than a search. Two readings were rejected:
"consecutive games finished" measures persistence rather than skill and quests
would have nothing to reward, and "every falsification found" alone rewards
marking every paragraph, which is the one strategy C2.1 exists to punish.

**Two paths, held to each other.** The counters are maintained incrementally,
because the plan forbids recomputing on a page load; and
`recomputePlayerStats` rebuilds a row from the `participant` rows, because
`attachGuestRecords` needs it — two aggregates cannot be added, since
`bestStreak` is a maximum over an ordering and two orderings interleave rather
than concatenate. `stats.test.ts` plays a sequence through the increments and
then rebuilds over the same rows, and asserts the two are identical. That
equality is what makes the fast path trustworthy, and it has already earned
itself: it caught the two sides computing `lastSeen` differently.

### E.7 — Export and delete

Built here rather than deferred, because it is an hour's work while the schema
is small and a week's work once quests, coins and leaderboards reference a
player. Delete removes the account and anonymises what must be kept for the
game's integrity — a finished room keeps its scores, attributed to a deleted
player.

## Exit gate

- Sign in with Google in production, from a phone.
- A guest can play a full game with no account, and keep that game on signing
  up.
- The profile shows real numbers, and the same numbers the admin panel reads.
- The email address appears nowhere another player can see.
- Export returns the account's data; delete removes it and leaves finished
  rooms coherent.
