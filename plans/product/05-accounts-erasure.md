# Track E — export and delete

The record of **E.7**: the two rights an account has over the data this game
holds about it. Its own sheet because `05-accounts-steps.md` had room for a
paragraph of intent and not for what building it found.

`05-accounts.md` keeps the step table — the only place that says where a step
stands.

## E.7 — export and delete  ✅

**Done when** an export returns the account's data, and a delete removes it and
leaves finished rooms coherent.

Built now rather than deferred, on the track's own argument: an hour's work
while the schema is small and a week's once quests, coins and leaderboards
reference a player. That argument got stronger while E.3 was being built —
`profile` now holds a pseudonym, and a deletion has to decide what a finished
room keeps.

## The delete did not work, and nothing said so

Every reference to `user` is already declared `cascade` or `set null`. Phase 2
did that deliberately, so `delete from "user"` reads like the whole job.

**It aborts.** `participant` carries `participant_account_or_guest`, a check
that a row names *either* an account or a guest. A solo round played by a
signed-in player has a `userId` and **no** `guestName` — `identify` never sets
one — so `set null` leaves a row that is neither, the check fires, and the
statement takes the whole delete with it.

Reproduced against Postgres before a line of the step was written:

```
DELETE FAILED — constraint: participant_account_or_guest
```

It is the same shape of finding as E.3b's: a design that reads correctly, and a
write path nobody had run. `account.test.ts`'s first case is that raw delete,
so the abort is asserted rather than remembered — and the fix cannot quietly
stop being needed.

## A name goes in before the account goes out

Which is also what the plan asked for in its own words: *a finished room keeps
its scores, attributed to a deleted player*.

**Every participant row is renamed, not only the nameless ones.** The nameless
ones are the solo rounds and they are what would abort the delete — but since
E.3.3 a signed-in player's *room* rounds carry their pseudonym in `guestName`,
and leaving those alone would delete an account and leave its public name in
every room it ever played.

**The placeholder is random, and one per deletion.** A fixed string shows two
deleted players in one room under one name, which reads as one person having
played twice. A hash of the id would be stable — and stable is exactly what a
deleted account must not be, because the same placeholder in two rooms says
those were the same person. It is shaped to pass `playerName`, because the
column is rendered in a debrief and read by `selectGameHistory`: a placeholder
no room could have shown is a row the rest of the application has to learn
about.

**Injected rather than generated in `packages/db`**, for the reason
`isPerfectRound` is: a test that cannot pin it can only assert that *something*
was written.

**One transaction.** An anonymisation that committed without its delete would be
an account whose rounds had been stripped of their name and which still existed
— the worst of both, and the test rolls one back to prove it.

## What `cascade` and `set null` were already saying

Nothing else needed writing, and reading the schema is what says why:

- **`cascade`** — sessions, provider links, the profile, the aggregate. The
  schema saying these have no meaning without the row above them.
- **`set null`** — reports. The schema saying the opposite: a report is about an
  article and outlives the reader who filed it. Its content stays; its author
  goes.

Asserted rather than trusted, both of them. A pseudonym that outlived its
account would be a name nobody could ever claim again, so there is a case for
the release too.

## The export, and the one thing it does not carry

**Composed from the queries that already exist** — `selectGameHistory`,
`selectPlayerStats` — so an export shows a player the same numbers their profile
does. A second implementation would be a second set of numbers to disagree.

**No session and no provider rows.** A hashed password and an OAuth refresh
token are data *about* this account, and handing them to whoever is holding the
browser is a credential leak wearing the word "export". The right of access is
to the data; the token is not it.

**It is the one route that hands a player's history to a browser**, which E.5
deliberately avoided by rendering the profile on the server. The exception is
narrow: the id it reads is the session's own, there is no parameter, and there
is nothing to get an authorisation check wrong on.

**Not encoded through a response schema**, unlike every other route here. An
export is not a shape two ends agreed on — it is *everything we hold* — and
encoding it would silently drop the first column somebody adds without widening
the schema, which is the one failure an export must not have because nobody
would ever see it. The catalogue records that the route exists and answers with
an object; `AccountExport` says what is in it.

## A guest has neither right here

Not because they have no data — they have rounds — but because a guest is not an
account: there is nobody to authenticate as, and an anonymous session that could
delete "its" rows is a deletion anybody's browser could perform on whatever it
happened to be holding. What a guest's data does is follow them into an account,
which is 4.3's design, and then both rights apply.

## Where a player finds them

On the profile, which is the one screen that is theirs and already shows what is
held about them. A settings page for two controls would be a screen nobody
visits and a right nobody knows they have.

**Export is a link, delete is a button behind a confirmation**, and the
asymmetry is the point: one can be done twice with no consequence and the other
cannot be undone at all. The confirmation asks the player to type their
pseudonym — the one thing they know and a mis-click does not — and it is not
case-folded, because this is a deliberate act rather than a login and the
moment's pause is the feature.

The export is a plain `<a download>` rather than a fetch: the browser knows how
to save a file, and the route answers with `content-disposition`. A script that
built a blob would be a second implementation of downloading.
