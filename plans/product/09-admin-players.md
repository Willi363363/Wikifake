# Track I — players and activity

The record of **I.3**. `09-admin.md` keeps the frame and the step table;
`09-admin-role.md` carries I.1 and `09-admin-health.md` I.2.

## I.3 — players and activity  ✅

**Done when** the panel says how many people there are, how many played, and who
plays most — each from a query somebody can read.

## Every figure is a query

Track I's exit gate, in its own words: *every figure traces to a query somebody
can read, with no in-memory maths that a second implementation could disagree
with*. So a count is `count(*)`, the split between accounts and guests is a
`filter (where …)` in one pass, and nothing here loads rows in order to length
them.

## A guest is a `user` row, so `count(*)` is not "signed up"

Step 4.3 gives a guest a real identity, so the rounds they play follow them into
an account. That makes the obvious query wrong: `count(*) from "user"` is signed
up **plus everybody who ever clicked play**.

Reported as sign-ups it would be wrong in the flattering direction, which is the
worst direction for a headline figure. So the two are counted apart and shown
apart, and `is_anonymous is not true` — not `= false` — because the column is
nullable and a row predating the plugin is an account.

## Today is the same today as a daily quest

`periodWindowOf` is called rather than a boundary computed here, and that is the
reason G.3 moved it out of the quest modules in the first place: a panel with
its own midnight reports a different day from the leaderboard beside it, and
both are defensible. A week begins on Monday, not seven days ago — a test uses
the Friday before a Thursday, which is inside seven days and outside this week.

**Players and not sessions.** One row per player, so eleven rounds today is one
active player. A session count would go up when a phone lost its network, which
is activity of the wrong kind.

## Ranked by finished, not started

Started is what an abandoned round also increments, so a list ordered by it is
topped by whoever opens rounds and leaves.

**The inner join to `profile` does two jobs**, which is the leaderboard's own
arrangement: it supplies the pseudonym and it restricts the list to accounts,
because a guest has no `profile` row and so no name to print. A filter by
construction rather than a `where` clause somebody has to remember.

The order is total — finished, then more recently seen, then id — so two reads of
the same data return the same list.

**Pseudonyms only.** E.3.3's promise holds on the admin panel as everywhere else:
there is no field for an email here, so there is nothing to leak. A test asserts
the row's keys are exactly the five it should have.

## Two indexes, each proved by dropping it

`player_stats` gained an index on `last_seen` and one on `games_finished desc`.
Both are measured in `admin-players.test.ts` on five thousand accounts, and each
assertion has a partner that **drops the index and watches the plan turn into a
scan** — an `EXPLAIN` that merely mentions an index name proves nothing about
whether the query needed it.

`desc nulls last` is spelled out in the ordering, which is H.2's finding: `order
by x desc` means `nulls first`, Drizzle writes `desc nulls last` into the index,
and the two disagree so the index goes unused. The column is `not null`, so this
changes no row — only whether the plan can use the index. Relying on a column
staying non-null is relying on the wrong thing.

## The layout is pairs, because a number alone teaches nothing

That is the track's own complaint about vanity metrics: accounts created goes up
and means nothing. Accounts beside guests, and ever-played beside accounts, are
what make the section say something. On each row of the list, rounds started sits
beside rounds finished, so the gap I.5 will call the abandon rate is visible
rather than computed by the reader.

## Mutations that must go red

- Guests counted as sign-ups.
- The list ranked by rounds started.
- The list including guests.
- Today as a rolling 24 hours; the week as the last seven days.
- The tie-break dropped, so two reads can disagree.
- The guest count hidden on the screen.
- Either index dropped.
