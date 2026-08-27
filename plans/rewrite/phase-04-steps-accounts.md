# Phase 4 — steps: accounts and guests

> Steps 4.2 and 4.3. The phase sheet, its exit gate and where each step stands:
> `phase-04-api-and-auth.md`. The deployment probes:
> `phase-04-steps-probes.md`. The game's routes: `phase-04-steps-game.md`.

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

### ✅ 4.3 — Attachable guest sessions

Playing without an account: `participant` references an account **or** a
guest. A game played as a guest attaches to an account created afterwards —
that is the exit gate of batch 5 of the source plan.

**Done when**: in an integration test, a game played as a guest appears in
the history of the account created afterwards.

#### A nickname is not an identity

The whole difficulty, and the sheet did not say it. `guestName` cannot carry
the attachment: two guests type the same name, and nothing connects the browser
that played to the account created twenty minutes later.

Better Auth's `anonymous` plugin supplies that connection. A guest gets a real
`user` row marked `isAnonymous`, so `participant.userId` is set from the first
game; `onLinkAccount` fires when they sign up, and the row is deleted
afterwards. `guestName` keeps a smaller job: the name shown for **that** game,
which an account's own name may differ from.

#### Which forced a migration, and a decision

Phase 2's check was `(userId is null) != (guestName is null)` — **exactly**
one. That is wrong, in two ways this step could not work around:

- A guest has **both**: an anonymous identity and a nickname for the game.
  Exclusivity forbade the normal case.
- The anonymous row is deleted once the account is real, and
  `participant.userId` is `set null` on delete. A row left with neither field
  fails the check, so the delete **aborts** — the attachment could not finish.

Migration `0004` relaxes it to "at least one", which keeps the property it was
written for: a row that is neither would be a score belonging to nobody. A
phase 2 test asserted the old rule and is rewritten rather than removed, with
the reason in the test.

#### The order the step rests on

`onLinkAccount` is awaited **before** the plugin deletes the anonymous row —
read in the plugin's source, not assumed. It is the only order that works:
after the delete the rows are unreachable, and before it they still point at a
user that is about to vanish. A test deletes the anonymous row after attaching
and asserts the history survives; another asserts that a participant left
stranded is refused, which is the failure the old check turned into an aborted
delete.

#### What follows the player

Games, with their answers, hint purchases and item uses — those hang off
`participant`, so moving it carries them. Flag reports too: `reporterId` is
`set null` on delete, so leaving them behind loses the author without failing
anything, the quiet kind of data loss. `attachGuestRecords` refuses to attach
an account to itself rather than doing nothing quietly: the same id twice means
a caller confused two variables.

#### The ORM stays out of the application

`apps/web` has no `drizzle-orm` dependency, and the first test that wanted one
was a signal — phase 2's exit gate says no free-form SQL outside
`@wikifake/db`. So `selectUserById` and `selectGameHistory` are named queries
there, and `HISTORY_QUERIES` carries the same negative assertion the
in-progress reads have: a history list and a debrief look alike, one of them is
about games somebody else may still be playing, so it must not mention
`game_position`. Step 4.4 owes the writes the same treatment — the two inserts
in this step's test are fixtures, not a pattern.

#### The race, for the fourth time

Two test files in `apps/web` truncating one database saw each other's rows, and
the symptom was the attachment appearing not to happen — the guest's game was
being deleted mid-test. `fileParallelism: false`, as `@wikifake/db` does.
Counting: Postgres deadlock in phase 2, Redis namespaces in phase 3, the shared
database in 4.2, this. Every integration suite sharing one store needs the
boundary stated, and the failure never says so.
