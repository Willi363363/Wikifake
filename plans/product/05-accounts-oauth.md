# Track E — step E.1, and the variable it turns on

`05-accounts.md` keeps the frame and the step table — the only place that says
where a step stands — and `05-accounts-steps.md` records what the other steps
decided. This is what E.1 actually consists of, because **it is a
deployment task and not a development one**: the code has been ready since phase
4, and what is missing is a pair of secrets that only a person with the Google
console open can produce.

## What is already true, verified in the code

- `apps/web/src/auth/providers.ts` offers a provider when **both** halves of its
  credential pair are present, and throws naming the missing half when only one
  is. Google and GitHub are both wired.
- `apps/web/src/auth/auth.ts` passes them to `better-auth`, and email-and-password
  is on unconditionally — so the game is playable and developable with nobody's
  OAuth console open.
- `callbackUrl()` computes the redirect URI, and `providers.test.ts` pins it. The
  runbook below quotes that function rather than a string somebody typed twice.

**Zero lines of application code are needed to add Google sign-in.** What this
step adds is the guard below, and what it waits on is the credentials.

## The trap this step closes

`BETTER_AUTH_URL` is `z.url().default('http://localhost:3000')`. That default is
right on a laptop and **silent everywhere else**: a deployment that never set it
builds every redirect URI against localhost, so a player who signs in with Google
is sent to *their own machine* afterwards and lands on nothing. Nothing logs it,
nothing fails, and the button looks fine.

The same default decides two more things — `REALTIME_ALLOWED_ORIGINS` falls back
to it, and `indexing.ts` uses it as the last resort for the canonical URL — so it
is one unset variable with three quiet consequences.

`assertCallbackReachable` refuses exactly that combination: a provider
configured, a platform hosting it (`VERCEL`, `RENDER`, `FLY_APP_NAME`, or
`NODE_ENV=production`), and a `BETTER_AUTH_URL` whose host is this machine. It
throws with the variable, its current value and the redirect URI the console
still needs, because that string is the next thing its reader has to paste
somewhere.

It stays quiet in the two cases that are not mistakes: a developer running the
flow against their own localhost, and a deployment with no provider at all —
which has no redirect URI to get wrong, and refusing to start it would be
refusing a game that works.

## The runbook — Google, production

1. **Google Cloud console → APIs & Services → Credentials → Create credentials →
   OAuth client ID**, application type *Web application*.
2. **Authorised redirect URIs.** One per origin that will serve the flow, in the
   shape `<BETTER_AUTH_URL>/api/auth/callback/google`. For production that is
   the public domain — the one runbook step 5 of `../rewrite/phase-10-cutover.md`
   is still to move. Add `http://localhost:3000/api/auth/callback/google` too, so
   the flow can be exercised on a laptop.
3. **OAuth consent screen.** External, and it stays in *Testing* until the game
   is public: in testing mode only the accounts listed on that screen can sign
   in, which is what you want while E.2's screens are being built. Publishing it
   is track J's, with the privacy policy that Google asks for.
4. **Vercel → Settings → Environment Variables**, Production:
   - `GOOGLE_OAUTH_CLIENT_ID`
   - `GOOGLE_OAUTH_CLIENT_SECRET`
   - `BETTER_AUTH_URL` — **check this one first.** If it is unset, the guard
     above now fails the auth route loudly instead of sending players to
     localhost; either way sign-in cannot work until it is the public URL.
5. Redeploy. Environment variables are read at runtime, but a redeploy is the
   only way to be sure which build is reading which.

## Previews are the part that will bite

Vercel gives every deployment a generated hostname, and Google refuses any
redirect URI that is not registered exactly. So OAuth **cannot** work on an
arbitrary preview: either register the branch's stable alias
(`wikifake-git-<branch>-<scope>.vercel.app`) as its own redirect URI, or test
sign-in on production and on localhost only.

Whatever is chosen, `BETTER_AUTH_URL` has to agree with it per environment. A
preview that inherits production's value will authenticate against production's
origin and set the cookie there, which looks like "sign-in silently does
nothing".

## Why E.1 cannot be closed by credentials alone

Its exit line is *"sign in with Google in production, from a phone"*, and there
is **no sign-in screen yet** — E.2 builds it. `better-auth`'s social flow is a
`POST` to `/api/auth/sign-in/social`, not a URL anybody can paste in a browser,
so until E.2 the only way to exercise the credentials is `curl`.

That is why the table marks E.1 ⚠️ rather than ✅: the code side is done and
guarded, the credentials are yours, and the demonstration waits for a button.
