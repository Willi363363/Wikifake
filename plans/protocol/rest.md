<!-- Generated from the Zod schemas in packages/protocol. Do not edit. -->
<!-- Regenerate with: pnpm --filter @wikifake/protocol docs -->

# REST — routes and payloads

Nine routes. A `GET` takes no body.

## `GET /ping`

**Response**

- `status` — `"alive"`

## `GET /api/health`

**Response**

- `status` — `"ok"`
- `version` — string (min 1 char)
- `commit` — string
- `commitShort` — string (max 7 chars)
- `model` — string (min 1 char)
- `llmConfigured` — boolean

## `GET /api/usage`

**Response**

- `usage` — object
  - `gamesGenerated` — integer (≥ 0)
  - `gamesServedFromCache` — integer (≥ 0)
  - `byKind` — record keyed by `"topic_choice"` | `"falsification"` | `"flag_verification"`, of objects
    - `calls` — integer (≥ 0)
    - `failures` — integer (≥ 0)
    - `promptChars` — integer (≥ 0)
    - `outputChars` — integer (≥ 0)
    - `inputTokens` — integer (≥ 0)
    - `outputTokens` — integer (≥ 0)
  - `totals` — object
    - `llmCalls` — integer (≥ 0)
    - `inputTokens` — integer (≥ 0)
    - `outputTokens` — integer (≥ 0)
  - `perGeneratedGame` — object
    - `llmCalls` — number (≥ 0)
    - `inputTokens` — number (≥ 0)
    - `outputTokens` — number (≥ 0)
  - `cacheHitRate` — number (0–1)
- `cache` — object | null
  - `categories` — integer (≥ 0)
  - `articles` — integer (≥ 0)
  - `maxCategories` — integer (≥ 1)
  - `variantsPerCategory` — integer (≥ 1)
  - `ttlSeconds` — integer (≥ 1)

## `POST /api/multiplayer/create`

**Request**

- object

**Response**

- `roomCode` — string (exactly 6 chars, matching `^[A-Z0-9]+$`)

## `POST /api/game/start`

**Request**

- `topic` — string (1–120 chars)
- `timeLimit` — integer (30–600) — optional

**Response**

- `sessionId` — string (16–64 chars, matching `^[A-Za-z0-9_-]+$`)
- `timeLimit` — integer (30–600)
- `topic` — string (1–120 chars)
- `paragraphs` — non-empty array of string
- `totalFakes` — integer (≥ 1)
- `wikipediaUrl` — string

## `POST /api/game/hint`

**Request**

- `sessionId` — string (16–64 chars, matching `^[A-Za-z0-9_-]+$`)
- `falseInfoNumber` — integer (≥ 1)
- `level` — `1` | `2` — default `1`

**Response**

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

## `POST /api/game/scan`

**Request**

- `sessionId` — string (16–64 chars, matching `^[A-Za-z0-9_-]+$`)
- `marked` — array of integer (≥ 1) — default `[]`

**Response**

- `paragraphIndex` — integer (≥ 1) | null

## `POST /api/game/submit`

**Request**

- `sessionId` — string (16–64 chars, matching `^[A-Za-z0-9_-]+$`)
- `marked` — array of integer (≥ 1)

**Response**

- `score` — integer
- `breakdown` — object
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

## `POST /api/flag-report`

**Request**

- `articleTitle` — string (1–300 chars)
- `articleUrl` — string | `""` — default `""`
- `flaggedClaim` — string (1–2000 chars)
- `proposedCorrection` — string (1–2000 chars)
- `quickNote` — string (max 500 chars) — default `""`
- `explanation` — string (max 2000 chars) — default `""`
- `sources` — array of string — default `[]`
- `playerId` — string (1–24 chars, matching `^[\p{L}\p{N}_\-. ]+$`) | `"anonymous"` — default `"anonymous"`
- `roomCode` — string (exactly 6 chars, matching `^[A-Z0-9]+$`) | `""` — default `""`

**Response**

- `id` — string (min 1 char)
- `status` — `"ai_reviewed"` | `"pending_human_review"` | `"rejected_by_ai"`
- `verification` — object
  - `verdict` — `"likely_valid"` | `"uncertain"` | `"unsupported"`
  - `confidence` — integer (0–100)
  - `reasoning` — string (min 1 char)
  - `sourcesFound` — array of string (min 1 char)
  - `recommendation` — `"approve_for_review"` | `"needs_more_info"` | `"reject"`
