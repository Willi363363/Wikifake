# Phase 1 — steps of `packages/protocol`

The definition of each step and its completion criterion. **State is not here**:
it lives in the tracking tables of `phase-01-core.md`, and in one place only.

Where the new contracts depart from the ones in `backend/src/`, and why, is in
`phase-01-protocol-decisions.md`.

## 1.1 — Skeleton of the two packages

`packages/protocol` and `packages/domain` on the shared configuration from
phase 0. `protocol` has a single runtime dependency, Zod; `domain` depends
on `protocol` and nothing else.

This step creates both packages, hence its place here rather than in the
`domain` sheet.

**Done when**: `pnpm build`, `pnpm test` and `pnpm typecheck` pass with a
trivial test in each package, and the dependency graph is exactly that one.

## 1.2 — WebSocket messages

One schema per incoming and outgoing message, modelled on the current
dispatch table. Error codes become a closed union (`room_not_found`,
`invalid_name`, `name_taken`, `bad_json`, `not_host`, `hints_blocked`, …).
`game_start` has a single shape for `players`: the divergence between the
two start paths (§2.1.3) becomes unrepresentable.

**Done when**: every message of the dispatch table has its schema, the types
are inferred through `z.infer` (no type redeclared by hand), and invalid
fixtures are rejected with the right code.

## 1.3 — REST DTOs and negative assertion

Schemas for `game/{start,hint,scan,submit}`, `health`, `usage`,
`multiplayer/create`, `flag-report`. The start payload cannot represent the
solution: no falsified positions, no explanations, no hints, no
`original_text` — only the count of fakes.

**Done when**: a test serialises a complete game start and checks, by keys
**and by values**, that no truth text or hint appears in it (§3.1); the
`/api/health` contract of §3.7 is represented field by field.

## 1.10 — Generated protocol documentation

The protocol doc is generated from the Zod schemas and committed. The full
CI lock (§3.8) comes in phase 11; here, the generator and the file.

**Done when**: a test compares the generated file to the committed file and
fails on divergence.
