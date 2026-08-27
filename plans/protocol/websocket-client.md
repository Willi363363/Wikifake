<!-- Generated from the Zod schemas in packages/protocol. Do not edit. -->
<!-- Regenerate with: pnpm --filter @wikifake/protocol docs -->

# WebSocket — messages a client sends

Thirteen messages, one per entry of the dispatch table. Anything else is
refused: the type is a closed union, so an unknown message is a rejection
rather than a silence (C5.3).

Why a field is shaped the way it is lives in the schemas themselves, and
the departures from the current protocol in
`../rewrite/phase-01-protocol-decisions.md`.

## `set_ready`

- `type` — `"set_ready"`
- `ready` — boolean — default `true`
- `withItems` — boolean — optional
- `timeLimit` — integer (30–600) — optional

## `get_lobby`

- `type` — `"get_lobby"`

## `force_start`

- `type` — `"force_start"`
- `withItems` — boolean — optional
- `timeLimit` — integer (30–600) — optional

## `submit_theme`

- `type` — `"submit_theme"`
- `topic` — string (1–120 chars)

## `force_pick`

- `type` — `"force_pick"`

## `start_game`

- `type` — `"start_game"`
- `topic` — string (1–120 chars)
- `withItems` — boolean — optional
- `timeLimit` — integer (30–600) — optional

## `live_score`

- `type` — `"live_score"`
- `score` — integer

## `cursor`

- `type` — `"cursor"`
- `x` — number clamped to [0,1]; anything else becomes 0
- `y` — number clamped to [0,1]; anything else becomes 0

## `chat_message`

- `type` — `"chat_message"`
- `content` — string (1–400 chars)

## `use_item`

- `type` — `"use_item"`
- `instanceId` — string (min 1 char)
- `targets` — array of string (1–24 chars, matching `^[\p{L}\p{N}_\-. ]+$`)
- `marked` — array of integer (≥ 1) — default `[]`

## `unlock_hint`

- `type` — `"unlock_hint"`
- `falseInfoNumber` — integer (≥ 1)
- `level` — `1` | `2` — default `1`

## `unsubmit_answer`

- `type` — `"unsubmit_answer"`

## `submit_answer`

- `type` — `"submit_answer"`
- `marked` — array of integer (≥ 1)
