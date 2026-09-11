# Track I — the role, and the route

The record of **I.1**. `09-admin.md` keeps the frame and the step table.

## I.1 — an admin role, and a route only it reaches  ✅

**Done when** exactly one kind of visitor sees the panel, and everybody else
cannot tell it is there.

## A table, not a column on `user`

`schema/auth.ts` says in its first line that it holds *"the four tables Better
Auth owns, plus nothing"*, and that boundary is worth more than the one join a
separate table costs: a column of ours inside a library's table is a column that
library's own migrations do not know about, and the day it changes its core
schema is the day it matters.

So `admin` is one row per admin, keyed on `user_id`. **The account's own id is
the primary key**, because *this account is an admin* is a fact that can only be
true once — a second row for the same person is a state nobody can interpret,
and a unique constraint beside a serial id says the same thing twice.

`on delete cascade`, so E.7's erasure cannot leave a privileged row pointing at
nobody. `granted_at` because *who has this and since when* is the first question
asked of any privileged list, and a nullable `note` because a list nobody can
explain is a list nobody dares remove anybody from.

## Nothing in the codebase writes it

Track I is read-only and its exit gate says so — *no write, no mutation, no
destructive action anywhere in the diff* — so granting is a statement a person
runs, which is what the plan asked for: *a flag on the account, set by a
migration, not by a screen*. The statement is in the schema file's own header:

```sql
insert into admin (user_id) select id from "user" where email = '…';
```

**The table arrives empty, and that is the safe default.** No admins means the
route answers 404 to everybody, including whoever deployed it. A panel that let
its first visitor in would have no access control at all for exactly as long as
nobody noticed.

## 404 and not 403

The plan's decision, in its words: *"an admin route that announces itself is a
target, and there is no reason to confirm it exists."*

A 403 tells a stranger they have found the right address and only lack the right
account — which is the half of the answer worth having. A 404 tells them nothing
they did not know before asking. So no session, a guest, an account without the
grant and a cookie that is not a session all get the identical answer, which is
`openRound`'s reasoning about `session_not_found` applied to a route.

**No redirect anywhere in the panel**, and that is the same decision seen from
the other side. Every other gated page in this application sends somebody
somewhere — `/sign-in`, `/sign-up`, `/choose-a-name` — and each of those
redirects *is* an answer: this page exists and you are not on it yet. Here that
answer is the thing being withheld. A test reads the route files and fails on a
`redirect(`.

## The answer is never cached

`isAdmin` is a lookup on a primary key, run on every page load. A stale *yes* in
a cookie is a way in that outlives the row being deleted, and what caching would
save is one index hit. There is a test that deletes the row and watches the same
session stop getting in.

## Two things a mutation found

**The guest check was decoration.** Deleting `isAnonymous` passed every case,
because a guest is not in `admin` anyway. It is now tested on the one input where
the two differ — a grant actually made to a guest's id, which must be ignored —
and the reason is worth having: the anonymous plugin deletes that row when they
sign up, so an admin guest is an admin who disappears, and whose privilege was
attached to a browser rather than to a person.

**"Every page calls the gate" passed on a page that only imported it.** Deleting
`await requireAdmin();` and leaving the import satisfied a `toContain`. The rule
now matches the call. That matters more than it looks: I.2 to I.7 add six
sections, and this test is what makes forgetting on the seventh a failing build
rather than a leak.

## The panel writes nothing, and that is checked

A second sweep reads every source under `src/admin/` for `.insert(`, `.update(`,
`.delete(`, a `POST`, and the two write helpers of track H, and fails on any of
them. The exit gate's last line is *no write anywhere in the diff*, and a promise
in a document is a promise the sixth section breaks.

## Mutations that must go red

- The admin check dropped; a guest let through; no session let through.
- The gate redirecting instead of answering 404.
- A page importing the gate without calling it.
- Anything under `src/admin/` writing.
