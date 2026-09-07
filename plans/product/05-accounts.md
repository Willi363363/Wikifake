# Track E — accounts and player statistics

| | |
|---|---|
| **State** | 🔶 E.2 done; E.1 guarded and awaiting credentials |
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
| E.2 | Sign-in and sign-up screens, on the direction | ✅ |
| E.3 | Pseudonym: chosen, unique, and the only public identifier | ⬜ |
| E.4 | `player_stats` — the aggregate a profile reads | ⬜ |
| E.5 | The profile screen | ⬜ |
| E.6 | Guest continuity — a guest game survives signing up | ⬜ |
| E.7 | Export and delete my account | ⬜ |

### E.2 — what the screens decided

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
