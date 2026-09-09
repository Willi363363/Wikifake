# Track E — the pseudonym

The record of **E.3**, which the list carried as one line — *pseudonym: chosen,
unique, and the only public identifier* — and which is three.

`05-accounts.md` keeps the step table: the only place that says where a step
stands.

## Why it is three steps

Read again, that one line names three rules with nothing in common but a noun:

- a **data** rule — no two accounts hold the same pseudonym;
- a **sign-up** rule — every account chooses one, including the ones Better Auth
  creates from a Google profile without asking us;
- a **room** rule — the pseudonym is what other players see, so a signed-in
  player stops typing a nickname per room.

Each has its own exit condition, each can be wrong on its own, and the third
cannot even be attempted before the first two hold. `../method/00-dev-cycle.md`
calls this its second overflow case — *the step was badly cut; rewrite the
steps, then resume* — which is what E.3b did four steps ago.

## E.3.1 — the pseudonym is a row, and no two accounts share one  ✅

**Done when** two accounts cannot hold the same pseudonym in any casing,
spacing or Unicode encoding, proved against a real Postgres, including for two
claims issued before either has committed.

### It is `profile.displayName`, not `user.name`

E.2 put the pseudonym in `user.name`, because that is the field
`signUp.email` takes. It cannot stay there.

**`user` belongs to Better Auth, and Better Auth writes that column itself.** A
Google sign-in fills it from the provider's profile without asking. A unique
index on it would turn *two people called Marie Dupont signed in with Google*
into a database error raised inside a library, on a path this repository does
not own — and the value it collided on would be a legal name rather than a
chosen one.

`profile` is ours. Phase 2 created it for exactly this and said so in a comment
— *what other players see, distinct from `user.name`, which is the account's* —
and until this step nothing but the seed had ever written a row. A refusal from
here is a sentence a player can act on.

### The fold is a stored column, because SQL cannot be trusted with it

A `unique index on lower(display_name)` looks equivalent and is not.
**Postgres folds case through the database's collation**, and under `C` that is
ASCII only: `ÉLISE` and `élise` would sit apart in the index while the
application believed they were one name. JavaScript's `toLowerCase` has the
whole Unicode table.

So `pseudonymKey` lives in `@wikifake/protocol`, beside the `playerName` schema
whose values it folds, and `display_name_key` stores what it returned. Three
foldings, each answering a way two names look identical on a screen: **NFC**,
because `é` has two encodings; **whitespace runs collapse**, because HTML
collapses them too; **lower case**, with `toLowerCase` rather than
`toLocaleLowerCase`, which maps `I` to `ı` under a Turkish locale and would key
the same pseudonym differently depending on the machine that ran it.

The column is denormalised, and it is the one kind that is safe: a pure function
of the column beside it, written in the same statement, so no row can exist
whose key is not its own name's.

### The constraint is the check, and there is nothing before it

`claimPseudonym` does not ask whether a name is free. Reading and then inserting
is two statements, and two sign-ups racing for the same name both read *free*.
The insert **is** the question: Postgres answers it once, under a lock nothing in
the process can see around, and a unique violation comes back as
`{ ok: false, reason: 'taken' }`.

A discriminated union rather than a boolean, so the day a claim can fail for a
second reason every caller stops compiling instead of reading `false` as
*taken*. And **only** a unique violation is converted: a foreign key violation —
a claim for a `userId` that is not an account — stays an error, because it is a
bug in the caller and not something a player retypes their way out of.

`profile.test.ts` asserts the race directly, with two claims settled together,
and asserts the guarantee again past `claimPseudonym` with a raw insert: what
holds is the schema's, not one function's care.

### The migration was rewritten by hand, and that is the interesting part

`drizzle-kit generate` produced one statement:

```sql
ALTER TABLE "profile" ADD COLUMN "display_name_key" text NOT NULL;
```

**Postgres refuses that on any table that already has a row** — checked, not
assumed: `column "b" of relation "t" contains null values`, SQLSTATE 23502. No
deployment writes `profile` today, but `pnpm seed` does, so every developer who
has ever seeded would have had `pnpm migrate` fail on them.

So 0007 is the four-statement version — add nullable, backfill, set not null,
add the constraint — and the backfill spells the fold in SQL
(`lower(regexp_replace(btrim(…), '\s+', ' ', 'g'))`) because at that instant
there is no other language available. That is a *backfill*, not the rule: it
runs once, over rows only a seed can have created, and any collision it produced
would stop the migration rather than pass quietly.

Editing the file is safe because drizzle computes the next diff from
`meta/*_snapshot.json` and never from the SQL — which is what
`scripts/normalise-migrations.ts` already relies on. Proved by replaying
0000…0007 against a database seeded between 0006 and 0007: `  Grace  Hopper  `
came out keyed as `grace hopper`.

### What this step deliberately does not do

**Nothing creates a `profile` row yet**, so no player has a pseudonym in the new
sense and no screen reads one. That is E.3.2, and it is the same shape as
E.3b.1 before E.3b.2: the data layer first, with its own exit condition, then
the path that feeds it.

**There is no rename.** `claimPseudonym` creates; the primary key on `userId`
means a second claim for an account that already has one comes back `taken`. A
player changing their pseudonym is a decision about who keeps a leaderboard
entry, and this step does not take it.

## E.3.2 — every account chooses one  ⬜

**What we do.** A `profile` row is what makes a pseudonym chosen, so its absence
is what marks an account that has not chosen. Sign-up claims one and shows the
refusal when it is taken; an account with a session and no row — every account
that arrived through Google — is sent to a screen that asks for one.

**Done when** an account cannot reach the game without a pseudonym, whichever
way it was created, and a taken one is refused with a sentence rather than a
stack trace.

## E.3.3 — it is the only public identifier  ⬜

**What we do.** A signed-in player stops typing a nickname per room: the lobby
offers their pseudonym, and `/api/realtime/ticket` mints for it. A guest keeps
typing one, because a guest has no pseudonym to offer.

**Done when** a room, a leaderboard and a shared score show a signed-in player's
pseudonym and nothing else, and two players in one room cannot be shown the same
name.
