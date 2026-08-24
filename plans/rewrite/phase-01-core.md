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

Ten steps across two packages, so the definitions live in two sheets. **The
tables below are the only place that says where a step stands** — the sheets
define the work and its completion criterion, and carry no state.

| # | Step — `packages/protocol` | State |
|---|---|---|
| 1.1 | Skeleton of the two packages | ✅ done |
| 1.2 | WebSocket messages | ✅ done |
| 1.3 | REST DTOs and negative assertion | ✅ done |
| 1.10 | Generated protocol documentation | to do |

Definitions: `phase-01-steps-protocol.md`. Departures from the current
contracts, and why: `phase-01-protocol-decisions.md`.

| # | Step — `packages/domain` | State |
|---|---|---|
| 1.4 | Scoring | ✅ done |
| 1.5 | Hints: monotonicity and billing | to do |
| 1.6 | Answer correction | to do |
| 1.7 | Item catalogue and effects | to do |
| 1.8 | Room reducer: lobby and host | to do |
| 1.9 | Room reducer: round | to do |

Definitions: `phase-01-steps-domain.md`.

Step 1.1 creates both packages, so it is defined with the `protocol` steps.
The numbering follows the order the work has to happen in, not the order of
the tables: 1.10 closes the phase.

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
