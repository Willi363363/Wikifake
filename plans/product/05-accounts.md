# Track E — accounts and player statistics

| | |
|---|---|
| **State** | 🔶 E.2, E.3.1, E.3.2, E.3b, E.4 and E.5 done; E.1 awaiting credentials |
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
| E.3.1 | The pseudonym is a row of its own, and no two accounts share one | ✅ |
| E.3.2 | Every account chooses one, including one that arrived through Google | ✅ |
| E.3.3 | It is the only public identifier: a room shows it and nothing else | ⬜ |
| E.3b.1 | Multiplayer results reach the database | ✅ |
| E.3b.2 | The socket player carries their account | ✅ |
| E.4 | `player_stats` — the aggregate a profile reads | ✅ |
| E.5 | The profile screen | ✅ |
| E.6 | Guest continuity — a guest game survives signing up | ⬜ |
| E.7 | Export and delete my account | ⬜ |

**E.3 was one line hiding three steps**, and the re-cut is in
`05-accounts-pseudonym.md` — the second of `../method/00-dev-cycle.md`'s three
overflow cases, the same one E.3b hit. "Chosen, unique, and the only public
identifier" is a *data* rule, a *sign-up* rule and a *room* rule, each with its
own exit condition and none of which fits in a branch with the other two.

**What each step decided, and what it got wrong first**, is in five sheets.
`05-accounts-oauth.md` carries E.1 — the runbook for the credentials, and the
guard on the variable they depend on. `05-accounts-multiplayer.md` carries E.3b,
which was found missing while E.4 was being built and turned out to be two steps.
`05-accounts-pseudonym.md` carries the re-cut and E.3.1, and
`05-accounts-choosing.md` carries E.3.2 and E.3.3. `05-accounts-steps.md`
carries the rest: E.2, E.4, E.5, and what E.7 involves. The table above is the
only place that says where a step stands.

## Exit gate

- Sign in with Google in production, from a phone.
- A guest can play a full game with no account, and keep that game on signing
  up.
- The profile shows real numbers, and the same numbers the admin panel reads.
- The email address appears nowhere another player can see.
- Export returns the account's data; delete removes it and leaves finished
  rooms coherent.
