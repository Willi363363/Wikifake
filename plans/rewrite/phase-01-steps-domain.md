# Phase 1 — steps of `packages/domain`

The definition of each step and its completion criterion. **State is not here**:
it lives in the tracking tables of `phase-01-core.md`, and in one place only.

The rule that governs every step below is in the pitfalls of
`phase-01-core.md`: the reducer decides, it does not apply. No `setTimeout`, no
Redis, no clock read — time is a parameter and effects are returned as data.

The skeleton of this package is step 1.1, in `phase-01-steps-protocol.md`,
because that step creates both packages at once.

## 1.4 — Scoring

`score = tp×150 − fp×80 − hint_penalty − score_stolen + time_bonus`, with
`time_bonus = max(0, time_limit − elapsed) × 0.5`, `HINT_COST = 50`,
`REVEAL_COST = 200`, `STEAL_AMOUNT = 50`. Time is a parameter. Negative
scores are possible, no bonus past the limit, leaderboard in descending
order.

**Done when**: the reference case of §3.2 passes — `tp=3, fp=1,
penalty=20, stolen=50, 200 s left out of 300 → 400` — along with the edges
(negative score, time exceeded).

## 1.5 — Hints: monotonicity and billing

Non-cumulative penalty (level 2 costs 200 in total, not 250), monotonic
levels, billed exactly once. Penalties declared by the client are ignored:
the breakdown is computed from server state.

**Done when**: level 2 unlocked then level 1 requested again returns
level 2 without billing again; repeating level 2 does not re-bill;
`hintsUsed: 9` declared by the client produces a breakdown of zero.

## 1.6 — Answer correction

Pure function that confronts the marked paragraphs with the `positions`:
1-based indices, sorted ascending, `false_info_number` sequential from 1
to n.

**Done when**: the shape cases of §3.3 pass (1-based, sorting, sequence),
and tp/fp are exact on partial, empty and over-marked answers.

## 1.7 — Item catalogue and effects

The catalogue is **one** object: identifiers can no longer diverge between
front and back. The eight effects are pure functions: SCANNER designates a
real fake not yet designated, remembered per player, `null` on exhaustion;
`HINT_LOCK` refuses the purchase with `code: hints_blocked`; `FREEZE_TIME`
really eats into the time bonus (§2.1.7); `targets` are validated — no
self-targeting, bounded count (§2.1.6).

**Done when**: every effect has its tests, SCANNER returns `null` on
exhaustion, and a self-targeted `use_item` is rejected.

## 1.8 — Room reducer: lobby and host

Entry and lobby transitions: join, leave, `ready`, theme vote and selection,
host authority — `force_start`, `force_pick`, `start_game` return `not_host`
to a guest without changing the state —, promotion when the host leaves,
room disappearing when the last player leaves. A guest changes their `ready`
but neither `time_limit` nor `with_items`, and `time_limit` is refused
mid-round (§2.1.6).

**Done when**: every lobby transition has its test, guards included
(`not_host`, out-of-phase message rejected explicitly, not silently
ignored).

## 1.9 — Room reducer: round

A **single** round start path, which purges all round state — closing the
penalty leak of the vote path (§2.1.2). Submissions, round end when everyone
has submitted, and the two missing transitions: round end on timer expiry,
round end on the disconnection of the last non-submitted player (§2.1.4).
Timers are effects returned by the reducer, not `setTimeout`s: phase 6 will
wire them onto BullMQ.

**Done when**: the reducer is covered transition by transition, including
the two missing ones, and a test checks that after a start via theme vote,
`hint_levels`, `score_stolen`, `hints_blocked_until` and `scanned` are
purged.
