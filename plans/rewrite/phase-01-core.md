# Phase 1 — Core

| | |
|---|---|
| **State** | in progress |
| **Branch** | `feat/rewrite-phase-1` |
| **Depends on** | phase 0 |
| **Delivers** | `packages/protocol` and `packages/domain`, pure and tested |

## Objective

Create the two packages marked ★ in `00-overview.md`: `protocol`, the single
source of the contracts — one Zod schema per WebSocket message and per REST
DTO — and `domain`, the game rules as pure functions: scoring, answer
correction, item catalogue, room state machine as a reducer
`(state, event) → {state, effects}`. No I/O, no implicit clock.

## Why now

The contract before the rules, the rules before the services: everything
that follows imports these two packages. This is the phase that structurally
removes the duplications of truth (§2.1.8: scoring present twice, item
identifiers synchronised by hand) and that makes visible the two transitions
missing from the current state machine: round end by timeout, round end on
the last player's disconnection (§2.1.4).

## Steps

### ✅ 1.1 — Skeleton of the two packages

`packages/protocol` and `packages/domain` on the shared configuration from
phase 0. `protocol` has a single runtime dependency, Zod; `domain` depends
on `protocol` and nothing else.

Two pieces of plumbing come with the skeleton, because every later step goes
through them and neither is a rule: `protocol` exports `decode`, the single
entry point that turns an unknown input into a result rather than an exception
— an invalid frame is an ordinary event, and Zod's error shape stays inside
that one file — and `domain` exports the `Reduced` shape that steps 1.7 to 1.9
return, which is what keeps effects data rather than `setTimeout` calls.

The graph is locked by a test rather than by a convention:
`packages/config/src/workspace-graph.test.ts` fails when either package grows
a runtime dependency, and when `protocol` grows a workspace one — the rules
import the contracts, never the reverse.

**Done when**: `pnpm build`, `pnpm test` and `pnpm typecheck` pass with a
trivial test in each package, and the dependency graph is exactly that one.

### ✅ 1.2 — WebSocket messages

One schema per incoming and outgoing message, modelled on the current
dispatch table. Error codes become a closed union (`room_not_found`,
`invalid_name`, `name_taken`, `bad_json`, `not_host`, `hints_blocked`, …).
`game_start` has a single shape for `players`: the divergence between the
two start paths (§2.1.3) becomes unrepresentable.

Thirteen inbound messages, fifteen outbound, nine error codes. The two
criteria are checked mechanically rather than by reading: a parity test
compares the catalogues to the `HANDLERS` table and to the `{"type": …}`
literals the Python actually emits, and another reads the source to assert
that every exported contract type comes from `z.infer`.

Where the new shapes depart from the current ones — naming, bounds, the
three errors that had no code — is written in
`phase-01-protocol-decisions.md`.

**Done when**: every message of the dispatch table has its schema, the types
are inferred through `z.infer` (no type redeclared by hand), and invalid
fixtures are rejected with the right code.

### ✅ 1.3 — REST DTOs and negative assertion

Schemas for `game/{start,hint,scan,submit}`, `health`, `usage`,
`multiplayer/create`, `flag-report`. The start payload cannot represent the
solution: no falsified positions, no explanations, no hints, no
`original_text` — only the count of fakes.

Nine routes, checked against the `@router` decorators. The negative assertion
runs on **both** transports. See `phase-01-protocol-decisions.md`.

**Done when**: a test serialises a complete game start and checks, by keys
**and by values**, that no truth text or hint appears in it (§3.1); the
`/api/health` contract of §3.7 is represented field by field.

### ✅ 1.4 — Scoring

`score = tp×150 − fp×80 − hint_penalty − score_stolen + time_bonus`, with
`time_bonus = max(0, time_limit − elapsed) × 0.5`, `HINT_COST = 50`,
`REVEAL_COST = 200`, `STEAL_AMOUNT = 50`. Time is a parameter. Negative
scores are possible, no bonus past the limit, leaderboard in descending
order.

**Done when**: the reference case of §3.2 passes — `tp=3, fp=1,
penalty=20, stolen=50, 200 s left out of 300 → 400` — along with the edges
(negative score, time exceeded).

### 1.5 — Hints: monotonicity and billing

Non-cumulative penalty (level 2 costs 200 in total, not 250), monotonic
levels, billed exactly once. Penalties declared by the client are ignored:
the breakdown is computed from server state.

**Done when**: level 2 unlocked then level 1 requested again returns
level 2 without billing again; repeating level 2 does not re-bill;
`hintsUsed: 9` declared by the client produces a breakdown of zero.

### 1.6 — Answer correction

Pure function that confronts the marked paragraphs with the `positions`:
1-based indices, sorted ascending, `false_info_number` sequential from 1
to n.

**Done when**: the shape cases of §3.3 pass (1-based, sorting, sequence),
and tp/fp are exact on partial, empty and over-marked answers.

### 1.7 — Item catalogue and effects

The catalogue is **one** object: identifiers can no longer diverge between
front and back. The eight effects are pure functions: SCANNER designates a
real fake not yet designated, remembered per player, `null` on exhaustion;
`HINT_LOCK` refuses the purchase with `code: hints_blocked`; `FREEZE_TIME`
really eats into the time bonus (§2.1.7); `targets` are validated — no
self-targeting, bounded count (§2.1.6).

**Done when**: every effect has its tests, SCANNER returns `null` on
exhaustion, and a self-targeted `use_item` is rejected.

### 1.8 — Room reducer: lobby and host

Entry and lobby transitions: join, leave, `ready`, theme vote and selection,
host authority — `force_start`, `force_pick`, `start_game` return `not_host`
to a guest without changing the state —, promotion when the host leaves,
room disappearing when the last player leaves. A guest changes their `ready`
but neither `time_limit` nor `with_items`, and `time_limit` is refused
mid-round (§2.1.6).

**Done when**: every lobby transition has its test, guards included
(`not_host`, out-of-phase message rejected explicitly, not silently
ignored).

### 1.9 — Room reducer: round

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

### 1.10 — Generated protocol documentation

The protocol doc is generated from the Zod schemas and committed. The full
CI lock (§3.8) comes in phase 11; here, the generator and the file.

**Done when**: a test compares the generated file to the committed file and
fails on divergence.

## Exit gate

- The cases of §3.2 and §3.3 pass as pure unit tests.
- The reducer is covered transition by transition, including the two that
  are missing today (timeout, last player's disconnection).
- No access to the clock, the network or the disk in `domain`: time is a
  parameter, effects are data.
- `pnpm build && pnpm test && pnpm lint && pnpm typecheck` pass.

## Contract touched

See `01-contract-to-preserve.md`: the **exact scoring** (§3.2, reference
case included), the **monotonicity of hints** and their single billing, the
**server authority** (§3.1: client penalties ignored, SCANNER resolved
server-side, `not_host`, score stealing and hint blocking applied
server-side), the contract shape of §3.3 (1-based indices, sorted positions,
sequential numbers) and the **documentation lock** (§3.8), whose generator
this phase lays down.

## Pitfalls

- **The reference scoring is `C2.1` of `01-contract-to-preserve.md`**, not
  `scoring.py` nor `config.js`: those two files are the duplication being
  removed, and nothing guarantees they still agree.
- **The reducer decides, it does not apply.** A `setTimeout`, a Redis access
  or a date read inside its body would make phase 6 untestable. Effects are
  returned values.
- Do not port the bugs along with the code: the partial reset of `themes.py`
  (§2.1.2) and the purely visual `FREEZE_TIME` (§2.1.7) are behaviours to
  fix, not references.
- Zod tolerates unknown keys by default: for the negative assertion of 1.3,
  test the **actual serialisation**, not only the schema.
- Do not spill over into transport: throttles, reconnection, room TTL belong
  to phase 6. Here, everything is pure.
