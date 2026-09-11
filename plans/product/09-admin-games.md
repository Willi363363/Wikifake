# Track I — rounds, and where they are lost

The record of **I.5**. `09-admin.md` keeps the frame and the step table; I.1 to
I.4 are in `09-admin-role.md`, `-health.md`, `-players.md` and `-activation.md`.

## I.5 — games, and the abandon rate  ✅

**Done when** the panel says how many rounds were played, how many were left,
and what share that is.

## The track asked for *by screen*, and the schema cannot answer it

The screens before a round exists — typing a topic, voting, waiting for
generation — **leave no row**, and a room's phase lives in Redis rather than
Postgres. There is nothing to group by.

So the split is **by mode**, which is the more useful cut anyway: the two
abandon for different reasons. Alone, somebody closes a tab; in a room, the
round ends without them. That limitation is printed on the screen rather than
left to be inferred from a column that quietly means something narrower.

## The denominator is the whole decision

**Only rounds that have ended.** A seat in a round still running has not
abandoned anything — it is a game in progress — and counting it would make the
rate climb every time somebody presses play and fall again when they submit. A
figure that moves for reasons nobody can act on is worse than no figure.

The mutation that removes that clause fails, and the screen shows *rounds still
open* in its own column so the gap between rounds and seats is visible rather
than mysterious.

**Seat by seat, not room by room.** A five-player room contributes five,
because the question is how many *people* left. A test asserts the property
that makes it a rate at all: submitted never exceeds seats — the classic way to
break this is a join that multiplies rows, and it would show up here first.

## A mode with no rounds still gets a row

An absent row and a zero say different things to somebody reading a dashboard:
the first looks like a bug in the panel and the second is a fact about the game.
So the rows come from the list of modes, not from what the query happened to
return.

## The total is summed, not asked for

A third query with its own `where` clause is a third chance to disagree with the
two above it. Summing the rows cannot disagree with them — and a test compares
the total against the sum, so a future column that forgot to be added shows up.

`shareOf` is I.4's, unchanged: **null when there is no whole**, so *no round has
ended* renders as an em dash rather than as a reassuring nought per cent.

## Mutations that must go red

- Seats counted in rounds that are still running.
- Rooms counted instead of seats.
- A mode with no rounds losing its row.
- The total's `submitted` taken from the wrong column.
- No rounds ended rendering as nought per cent.
- The caveat dropped from the screen.
