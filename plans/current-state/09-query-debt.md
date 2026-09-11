# Current state — what gets slow, and why

The fourth register. `05-known-debt.md` holds defects with a `file:line`,
`06-structural-debt.md` the shape of the code, `08-toolchain-debt.md` the
commands you run, `10-test-debt.md` the suites — and this one holds **query
plans**: what is slow, at what size, and what was measured rather than assumed.

It exists because the other three had all reached their 200-line cap, and
because these findings share a shape: each is a number taken on a seeded table,
each names the plan Postgres chose, and each is worth re-measuring rather than
re-reasoning when somebody acts on it.

Every entry here should carry a measurement. A performance note without one is a
guess with a file name attached.

## `DESC NULLS LAST` in an index does not serve `ORDER BY … DESC`

Found in H.2, and it is the kind of defect that ships in silence.

**`order by x desc` means `desc nulls first` in SQL.** Drizzle's `.desc()`
produces `DESC NULLS LAST` in an *index definition* and a bare `desc` in an
*order by*, so the two do not match — and Postgres will not use the index for
the ordering. It reads every qualifying row and sorts them.

Measured on a ledger of five thousand movements, the same query either way:

```
order by seq desc              cost 139    0.77 ms   Seq Scan + top-N sort
order by seq desc nulls last   cost 0.35   0.08 ms   Index Scan, stops at row 1
```

Ten times faster, and constant rather than linear. The columns involved are
`not null`, so **the two orderings can never differ in result** — only in whether
an index may be used, which is why nothing catches it.

`queries/coins.ts` spells `desc nulls last` and says why. **What is not fixed is
everywhere else it applies**, and at least one place it demonstrably does:

- **`leaderboard_mode_score_idx` is `(mode, score DESC NULLS LAST, …)` and
  `boardQuery` orders `desc(score)`.** Probed by changing that one ordering and
  re-running G.4's volume test: the all-time board went from **45 ms to 26 ms**
  at fifty thousand entries, with all fourteen cases still passing. Reverted,
  because a performance change to a shipped step is not an aside in a step about
  a coin ledger.

Worth a sweep rather than a fix in passing: every `.desc()` in an index, against
every query that orders on it. The fix is one clause per query and the win is
measurable, so it deserves its own step and its own before-and-after.

## The all-time leaderboard reads the whole mode, because it needs a name

Moved here from `06-structural-debt.md`, where it was a pointer.

Measured in G.4 at fifty thousand entries: the daily, weekly and regional boards
answer in 2–3 ms with their range pushed into an index; the all-time board takes
45 ms, reading every entry in the mode.

**The scan is the cause — not the index, and since G.7 not the sort either.** A
board is one row per player now, so `distinct on` reduces twenty-five thousand
entries to two thousand before the ordering; but every entry is still read to
find each player's best, and deduplicating costs more than sorting did. Its cost
grows with the game's history where every other board's grows with its period.

Part of that 45 ms is the ordering mismatch above — 19 ms of it, probed. The
rest is inherent to the deduplication. The two ways out, and why forcing a
nested loop measures nothing, are in `../product/07-leaderboards-queries.md`.
