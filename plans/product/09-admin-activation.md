# Track I — activation and return

The record of **I.4**. `09-admin.md` keeps the frame and the step table; I.1 to
I.3 are in `09-admin-role.md`, `-health.md` and `-players.md`.

## I.4 — activation and return  ✅

**Done when** the panel answers the question the track built it for: *of the
accounts created, how many played — and how many came back*.

## Four numbers, each a subset of the one above

**Created → started → finished → returned.** One query, not four: four
`count(…) filter (where …)` over the same join, because asking separately would
be four scans and, worse, four chances for the population to differ between them.

A test asserts the nesting directly — no step may exceed the one above it. That
is the property that makes it a funnel rather than four numbers, and if a future
clause broke it every ratio would silently go over one.

## The `left join` is the first step

A `player_stats` row appears when a first round *starts*, so an account that
signed up and never pressed play has none. An inner join would drop exactly the
people the first ratio is about — the mutation that swaps it fails three cases.

**Guests are excluded**, for I.3's reason carried forward: a guest is a `user`
row and cannot be a created account, so including them would put the funnel's
denominator at the mercy of how many browsers opened the site.

## Coming back is a later day, not a second round

`games_finished >= 2` is the obvious query and it is wrong: **two rounds in one
sitting is not coming back.** So the test is a later UTC *date* on `last_seen`
than on `first_seen` — late one evening and early the next morning counts, and a
five-round afternoon does not.

UTC, because that is the day `periodIndexOf` uses and a panel measuring its own
day would disagree with the leaderboard beside it.

**What it cannot say is how much later.** A return the next day and a return six
months on are the same row, because nothing records per-day history. A cohort
curve would need it. That limitation is printed on the screen rather than left
to be discovered, which is the honest thing to do with a figure somebody will
quote.

## Null is not nought per cent

`shareOf` returns **null when there is no whole**, and that distinction is the
one thing on this section that could embarrass it: a panel reading **0%** on its
headline figure the day before launch would report a failure that has not
happened. An em dash says *no whole*; a real zero — a hundred accounts and
nobody played — still reads `0%`, and a test holds the two apart.

It is also the only division in the feature. The exit gate says *no in-memory
maths that a second implementation could disagree with*, and a percentage is
exactly the shape of thing that gets recomputed in a template — one place
rounding to a whole number, another to a decimal, both defensible and quietly
disagreeing. Nothing is rounded before the screen, because a number rounded
early is a number the screen cannot format for its locale.

## The return rate divides by the people who could return

Not by accounts created. Coming back is a thing only somebody who played can do,
and the other denominator would blame the return rate for a sign-up funnel's
losses — two failures reported as one, and the wrong one.

## The bars are decoration

A length is not a fact a screen reader can read, and the percentage is already
in text beside it — so every bar is `aria-hidden`. Each is drawn as a share of
the *top* of the funnel, so the four read as a funnel rather than as four
unrelated proportions.

## Mutations that must go red

- An inner join, dropping accounts that never played.
- Guests counted in the funnel.
- *Came back* meaning a second round.
- No whole rendering as nought per cent.
- The return rate divided by accounts created.
- The bars announced as information.
