<!-- Generated from the Zod schemas in packages/protocol. Do not edit. -->
<!-- Regenerate with: pnpm --filter @wikifake/protocol docs -->

# WebSocket — messages the server sends

Fifteen messages. `game_end` is the only one that carries the solution
(C1.2), and no round-start payload can represent it (C1.1).

## `lobby_update`

- `type` — `"lobby_update"`
- `players` — array of objects
  - `name` — string (1–24 chars, matching `^[\p{L}\p{N}_\-. ]+$`)
  - `colour` — string (matching `^#[0-9a-fA-F]{6}$`)
  - `ready` — boolean
  - `answered` — boolean
  - `isHost` — boolean

## `theme_vote_start`

- `type` — `"theme_vote_start"`

## `theme_vote_update`

- `type` — `"theme_vote_update"`
- `submitted` — array of string (1–24 chars, matching `^[\p{L}\p{N}_\-. ]+$`)
- `total` — integer (≥ 0)

## `theme_selected`

- `type` — `"theme_selected"`
- `topic` — string (1–120 chars)
- `proposer` — string (1–24 chars, matching `^[\p{L}\p{N}_\-. ]+$`) | null
- `ballots` — record keyed by string (1–24 chars, matching `^[\p{L}\p{N}_\-. ]+$`), of string (1–120 chars)

## `game_start`

- `type` — `"game_start"`
- `topic` — string (1–120 chars)
- `paragraphs` — non-empty array of string
- `totalFakes` — integer (≥ 1)
- `wikipediaUrl` — string
- `players` — array of objects
  - `name` — string (1–24 chars, matching `^[\p{L}\p{N}_\-. ]+$`)
  - `colour` — string (matching `^#[0-9a-fA-F]{6}$`)
- `withItems` — boolean
- `timeLimit` — integer (30–600)

## `live_score_update`

- `type` — `"live_score_update"`
- `player` — string (1–24 chars, matching `^[\p{L}\p{N}_\-. ]+$`)
- `score` — integer

## `cursor_update`

- `type` — `"cursor_update"`
- `player` — string (1–24 chars, matching `^[\p{L}\p{N}_\-. ]+$`)
- `x` — number (0–1)
- `y` — number (0–1)

## `chat_message`

- `type` — `"chat_message"`
- `sender` — string (1–24 chars, matching `^[\p{L}\p{N}_\-. ]+$`)
- `content` — string (min 1 char)

## `items_distributed`

- `type` — `"items_distributed"`
- `wave` — integer (≥ 1)
- `items` — record keyed by string (1–24 chars, matching `^[\p{L}\p{N}_\-. ]+$`), of objects
  - `instanceId` — string (min 1 char)
  - `itemId` — `"HINT_LOCK"` | `"FREEZE_TIME"` | `"SCORE_STEAL"` | `"SCANNER"` | `"EARTHQUAKE"` | `"BLACKOUT"` | `"BLUR"` | `"RICKROLL"` | `"MIRROR"` | `"TINY"` | `"SPIN"` | `"CONFETTI"` | `"INVERT"`

## `item_effect`

- `type` — `"item_effect"`
- `itemId` — `"HINT_LOCK"` | `"FREEZE_TIME"` | `"SCORE_STEAL"` | `"SCANNER"` | `"EARTHQUAKE"` | `"BLACKOUT"` | `"BLUR"` | `"RICKROLL"` | `"MIRROR"` | `"TINY"` | `"SPIN"` | `"CONFETTI"` | `"INVERT"`
- `from` — string (1–24 chars, matching `^[\p{L}\p{N}_\-. ]+$`)

## `item_used`

- `type` — `"item_used"`
- `player` — string (1–24 chars, matching `^[\p{L}\p{N}_\-. ]+$`)
- `itemId` — `"HINT_LOCK"` | `"FREEZE_TIME"` | `"SCORE_STEAL"` | `"SCANNER"` | `"EARTHQUAKE"` | `"BLACKOUT"` | `"BLUR"` | `"RICKROLL"` | `"MIRROR"` | `"TINY"` | `"SPIN"` | `"CONFETTI"` | `"INVERT"`
- `targets` — array of string (1–24 chars, matching `^[\p{L}\p{N}_\-. ]+$`)

## `hint_unlocked`

- `type` — `"hint_unlocked"`
- `falseInfoNumber` — integer (≥ 1)
- `hint` — string (min 1 char)
- `charged` — integer (≥ 0)
- `hintPenalty` — integer (≥ 0)
- `grant` — one of 2 shapes
  - shape 1
    - `level` — `1`
  - shape 2
    - `level` — `2`
    - `truth` — string (min 1 char)
    - `paragraphIndex` — integer (≥ 1)

## `scanner_result`

- `type` — `"scanner_result"`
- `paragraphIndex` — integer (≥ 1) | null

## `game_end`

- `type` — `"game_end"`
- `leaderboard` — array of objects
  - `player` — string (1–24 chars, matching `^[\p{L}\p{N}_\-. ]+$`)
  - `colour` — string (matching `^#[0-9a-fA-F]{6}$`)
  - `score` — integer
  - `breakdown` — object | null
    - `truePositives` — integer (≥ 0)
    - `falsePositives` — integer (≥ 0)
    - `hintsUsed` — integer (≥ 0)
    - `hintPenalty` — integer (≥ 0)
    - `scoreStolen` — integer (≥ 0)
    - `timeBonus` — integer (≥ 0)
- `solution` — non-empty array of objects
  - `paragraphIndex` — integer (≥ 1)
  - `falseInfoNumber` — integer (≥ 1)
  - `falseStatement` — string (min 1 char)
  - `explanation` — string (min 1 char)
  - `hint` — string (min 1 char)

## `error`

- `type` — `"error"`
- `code` — `"room_not_found"` | `"invalid_name"` | `"name_taken"` | `"bad_json"` | `"not_host"` | `"hints_blocked"` | `"no_theme_submitted"` | `"topic_not_found"` | `"generation_failed"` | `"session_not_found"` | `"hint_not_found"` | `"room_capacity_reached"` | `"invalid_target"` | `"out_of_phase"` | `"item_not_held"`
- `message` — string (min 1 char)
