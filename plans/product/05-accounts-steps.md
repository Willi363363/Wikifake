# Track E — what each step decided

The record of track E's steps: what each one settled, and what it got wrong
before it was right. `05-accounts.md` keeps the frame and the step table — the
only place that says where a step stands — and `05-accounts-oauth.md` carries
E.1, which is a deployment task rather than a development one.

Its own sheet because the frame file reached the 200-line cap, and
`../method/00-dev-cycle.md` says a phase that outgrows its file splits into
satellite sheets rather than being squeezed into one.

## E.2 — what the screens decided

**One component, two modes.** Sign-in and sign-up differ by one field, one call
and the link at the bottom, so `credentials-form.tsx` and `account-screen.tsx`
are each rendered twice. Two files would drift the first time somebody fixed a
label on one of them, and nobody opens both at once — the same argument track C
made for `ArticleBeat`, and the same answer.

**The server's sentences are the good ones.** What the screen checks is what a
player can fix before a round trip: an empty address, a password under Better
Auth's own eight-character floor, and a pseudonym `playerName` would refuse —
the protocol's decoder, so an account cannot be created under a name its owner
could never play a room as. Everything else is Better Auth's message shown
verbatim, because a client that invented "that email is taken" would be
guessing at a race it cannot see. The one sentence the screen writes for itself
is *unreachable*: a refusal and a dead connection are different things, and
telling somebody on a train that their password is wrong is a lie.

**The providers cross as names, never as credentials.** The pages are server
components holding `Env`, and anything handed to a client component is
serialised into the document. `offeredProviders` exists so that the value
crossing that boundary has a type that cannot carry a secret, and
`providers.test.ts` asserts both halves — the names come out, and the secrets
`socialProviders` really does return do not.

**No `baseURL` on the client**, deliberately: it defaults to the page's own
origin, and the social flow is started with a *path*. An absolute URL is how a
preview deployment bounces a player into production, authenticates them there,
and looks like a button that does nothing.

Both screens carry a way past themselves — *play without an account* — because
one of this effort's three conditions for "done" is a first-time visitor who
plays without signing up, and a sign-in page with no exit is how that quietly
stops being true. Both are `noindex`: a sign-in form is not content.

## E.4 — What a statistic is

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

## E.5 — what the profile decided

**A server component, and no endpoint.** The stats are one row keyed by the
session's own user id, so rendering them on the server means no route exists
whose job is to hand a player's history to a browser — one fewer surface to get
an authorisation check wrong on. There is deliberately no `/api/profile/:id`,
and there should not be one until something needs a *stranger's* numbers.

**Three answers to a request, and the middle one is the decision.** No session
is somebody who has not signed in, and they are sent to sign in. An **anonymous
session is a guest** — a real `user` row, so that what they play follows them —
and a guest has no profile: they are sent to *sign up*, which is the screen that
turns what they have already played into something with a name on it. Showing
them an empty profile would be showing them a room with nothing in it.

**A missing figure is a dash, never a zero.** `selectPlayerStats` returns null
for a best score nobody has set, and the screen keeps the null. A `0` there
would look right in every screenshot and read as *you scored nothing* to every
new player.

**The email is on this screen and no other.** The promise is that it never
appears in a room, a leaderboard or a shared score; a player's own profile is
none of those, and the sentence saying so is beside the address rather than in a
policy nobody opens.

**`TIME_ZONE` was forced by this step.** `next-intl` warns when a date is
formatted without one, and the warning is about exactly the failure a server
component invites: the server formats in the machine's zone — UTC on Vercel —
and the browser in the viewer's, so a date can render as one day and hydrate as
another. It is declared once, in `i18n/locales.ts`, for every date this
application will ever show. A per-player zone is a preference and belongs with
`profile.preferences`.

**Reachability is part of the step.** A profile nothing points at is a profile
nobody opens, so the entry screen — the one screen every player passes through,
and where signing in lands — carries the single link. The route decides which:
a signed-in player is offered their profile, everybody else an account, and the
decision is made on the server so it does not flicker after hydration.

## E.7 — Export and delete

Its own sheet, `05-accounts-erasure.md`: the intent fitted in a paragraph and
what building it found did not. In short — built now because it is an hour's
work while the schema is small and a week's once quests, coins and leaderboards
reference a player, and because `delete from "user"` turned out to abort.
