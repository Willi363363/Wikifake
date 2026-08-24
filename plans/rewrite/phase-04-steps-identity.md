# Phase 4 — steps: identity and deployment

> Steps 4.1 to 4.3. The phase sheet, its exit gate and where each step stands:
> `phase-04-api-and-auth.md`. The game's routes:
> `phase-04-steps-game.md`.

### ✅ 4.1 — `/ping` and `/api/health` field by field

`GET /ping` responds with **exactly** `{"status": "alive"}`. `GET /api/health`
exposes `status`, `version`, `commit` (string present even when empty
locally), `commit_short` (7 characters), `model`, `llm_configured`
(boolean). The API key never appears. The CI probe compares `commit` to the
pushed SHA: this contract must survive field by field, or the deployment
verification loop dies silently.

**Done when**: a test compares the response field by field, including the
locally empty `commit` case, and a by-values test checks that the API key
does not appear in the serialised JSON.

#### What this step also had to create

`apps/web` did not exist: phase 0 left the `apps/` tree "empty but declared".
So 4.1 scaffolds the Next.js 16 application — App Router, React 19 — with
exactly two routes in it.

**Every response leaves through its contract.** `src/respond.ts` encodes with
the schema from `@wikifake/protocol` rather than with `Response.json`. That is
not decoration: Zod strips what a schema does not declare, so a handler that
later spreads the solution into a payload loses it at the encoder instead of in
a player's console. C1.1 becomes a property of the boundary rather than of
whoever writes the next handler, and a test asserts the stripping.

**`/api/health` validates no environment.** It reads the three variables it
needs directly and calls `loadEnv` nowhere. `loadEnv` validates the database,
the cache and the model key, and a probe that refuses to answer without a
working database goes silent exactly when someone needs it to speak. The
default model name is exported from `@wikifake/env` so the fallback is not
retyped here.

**Both routes are dynamic.** `/api/health` is forced so, because a statically
evaluated handler would bake in the commit of the machine that built it — on a
rebuild of an old commit the probe would then report a match that is not one.
Next made `/ping` dynamic on its own, which is also right: a `/ping` cached at
the edge answers "alive" for an application that is dead.

**The camelCase rename is safe, and now tested.** Phase 1 decided field names
are camelCase, so `commit_short` and `llm_configured` become `commitShort` and
`llmConfigured`. `deploy-check.yml` reads **only** `commit` and `version`,
neither of which moves — verified in the workflow, and locked by a test that
asserts those two names specifically, apart from the field-by-field one.

**The version has one source while two applications serve it.** It comes from
`apps/web/package.json`, and a parity test asserts it equals
`backend/src/version.py`. That test dies with the Python in phase 10,
deliberately.

**The build runs on webpack, not Turbopack, and that is debt.** The workspace's
packages export raw TypeScript whose internal imports carry a `.js` extension,
and the bundler has to be told that `./x.js` means `./x.ts`. `extensionAlias`
does that and is a webpack option; Turbopack accepts the flag as an experiment
and ignores it. Recorded in the debt register with the durable fix — give the
packages a build step — which is its own piece of work because it changes what
every package's tests exercise.

### ✅ 4.2 — Better Auth

Better Auth in the project's Postgres: `user`, `session`, `account`,
`verification` tables (phase 2 schema), OAuth, `/api/auth/*` routes mounted
in `apps/web`.

**Done when**: creating an account, opening then closing a session work in
an integration test against the database.

#### What the step decided

**The schema was verified, not trusted.** Phase 2 wrote the four tables from
Better Auth's documented core shape, and `account.issuer` — required, and
absent from what the published documentation lists — looked like a guess that
could have been wrong. Checked against `getAuthTables` in 1.7.1 before writing
a line: it is real and required. Phase 2 was right, and the comment in
`schema/auth.ts` that said "wired in phase 5" is corrected.

**The providers come from the environment, and no provider is named in code.**
The plan says "OAuth" and names none, because that is a deployment decision.
Every credential pair is optional, and `providers.ts` offers exactly the ones
whose pair is present. **Half a pair throws, naming the missing half** — that
is somebody's intention, half-typed, and silently not offering the provider
would leave them staring at an absent sign-in button with no explanation.

**Email and password is always on.** Not because it is the interesting path,
but because this step's criterion must not depend on a third party being
reachable, and because the game has to stay developable with nobody's OAuth
console open.

**`auth()` is lazy.** Building the instance validates the whole environment and
opens a connection; at module load that would make importing anything in
`src/auth/` — from `/api/health`, say — depend on a reachable database. A test
asserts the route module imports without connecting.

**The application has its own test database.** `@wikifake/db` truncates every
table in `public` between tests and Turbo runs package tasks in parallel, so a
test here on the shared database would have its rows deleted mid-flight by a
suite in another package. This is the third time that shape of race has come up
— the Postgres deadlock in phase 2, the Redis namespaces in phase 3 — so this
time it gets a boundary: `<database>_web`, created and migrated by the harness.

**Signing up also signs you in.** Pinned by its own test, because it is not
obvious and 4.3 depends on it: a guest who creates an account arrives already
holding a session.

**Signing out closes one session, not all of them.** Asserted by token rather
than by counting: logging a player out of their phone because they closed a tab
is a bug that a count-based test would not see.

#### What is still yours to decide

Which provider, and its credentials. `google` and `github` are supported;
adding another is a two-line entry in `providers.ts`. The redirect URI a
console has to be told is `<BETTER_AUTH_URL>/api/auth/callback/<provider>`, and
`callbackUrl()` builds it so the shape is not retyped into a form by hand.

`BETTER_AUTH_SECRET` is now required — at least 32 characters, because it signs
every session cookie, so a short one is a forgeable session rather than a weak
setting. `openssl rand -base64 32`.

#### One thing a bite test corrected

Removing the adapter's `schema` option left every test passing, which looked
like unverified configuration. It is not: swapping `user` and `session` in it
fails four tests, so the option is read. Removing it works only because
`connect()` already hands the full schema to Drizzle and the adapter falls back
to that. Kept explicit for exactly that reason — a `connect()` that stopped
embedding its schema would otherwise start depending on the fallback in
silence.

### 4.3 — Attachable guest sessions

Playing without an account: `participant` references an account **or** a
guest. A game played as a guest attaches to an account created afterwards —
that is the exit gate of batch 5 of the source plan.

**Done when**: in an integration test, a game played as a guest appears in
the history of the account created afterwards.
