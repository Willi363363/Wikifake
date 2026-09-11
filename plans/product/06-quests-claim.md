# Track F — claiming a reward

The record of **F.6**. `06-quests.md` keeps the frame and the step table — the
only place that says where a step stands — `06-quests-steps.md` carries F.1 to
F.3, and `06-quests-progress.md` carries F.4 and F.5.

A fourth file because the third reached 254 lines against a limit of 200. Four
sheets for seven steps is more than track E needed, and the reason is worth
naming: every step in this track has produced a *decision* worth keeping, and
three of them corrected an earlier step. That is the cost of a plan being
rewritten as it is built, and it is cheaper than the alternative.

## F.6 — claiming, exactly once  ✅

**Done when** a completed quest can be claimed, a second claim is refused, and
two claims arriving together pay one.

### It marks and credits nothing, and that was the owner's call

The plan asks for a reward "credited in the same transaction that marks the
quest claimed, or neither". There is no wallet: **track H owns the balance** and
the dependency graph puts H after F. So F.6 delivers the once-only marking and
the transaction boundary a credit slots into — `claimQuest` already takes a
transaction, so when H arrives the credit goes inside the same one.

Recorded rather than assumed: this was put to the owner as a fork — mark only,
add the balance now, or reorder F.6 behind F.7 — and mark-only was chosen.

### The guarantee is one conditional update

    set claimed_at = $at where id = $1 and user_id = $2 and claimed_at is null

Two requests both match the `is null`; only one row can be updated by both,
because the second waits on the first's row lock and then re-evaluates the
predicate against a `claimed_at` that is no longer null.

**Completeness is judged above it, not inside it.** `isQuestComplete` over
`progressFor` lives in `domain`, and `db` may not import them — so the handler
reads, judges, then claims, and only the last step is atomic. Two callers who
both see *complete* race at the update and one loses. That is safe in one
direction only, which is the direction that matters: a claim refused to somebody
who earned it is fixed by clicking again, and a reward paid twice is not.

The early `claimedAt !== null` check in the handler is a **short-circuit and not
the guarantee** — it looks like one, which is why the source says so. Deleting
it passes every test, correctly: `claimQuest` refuses with the same code. What it
buys is the window query, skipped for a quest with nothing left to pay.

### Three error codes, because a player can act on the difference

`quest_not_complete` becomes claimable by playing; `quest_already_claimed` never
becomes anything; `quest_not_found` covers absent *and* somebody else's, one code
for both — telling those apart would confirm a row's existence to whoever
guessed at its identifier. C5.1's rule: a client branches on a code, not prose.

### What the mutation run found, twice

**First run: three of four survived.** One was a bad mutation of mine — a no-op —
but the other two were real:

- **The window taken from `now()` instead of from the quest's own
  `periodIndex`.** Survived because every quest in the suite belonged to *today*,
  so nothing could tell the two apart. Two cases fix that, and they pin the
  window from both sides: yesterday's quest finished yesterday must pay, and
  yesterday's quest with only today's rounds must not. The mutation now fails
  both.
- **The early claimed check deleted.** Survived correctly — see above. Documented
  in the source rather than defended with a test that would have to assert an
  extra query nobody can observe.

The lesson is the same one `10-test-debt.md` records from the database half:
a suite where every fixture shares a value cannot see a function reading the
wrong one. Fixtures that vary the thing under test are what make a mutation run
mean anything.
