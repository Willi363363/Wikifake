<!-- Generated from the Zod schemas in packages/protocol. Do not edit. -->
<!-- Regenerate with: pnpm --filter @wikifake/protocol docs -->

# REST — routes and payloads

12 routes, the ones a player's browser calls. A `GET`
takes no body. The probes and the cron are in `rest-operations.md`.

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

## `POST /api/realtime/ticket`

**Request**

- object

**Response**

- `ticket` — string (min 1 char)
- `playerName` — string (1–24 chars, matching `^[\p{L}\p{N}_\-. ]+$`)

## `POST /api/account/pseudonym`

**Request**

- `pseudonym` — string (1–24 chars, matching `^[\p{L}\p{N}_\-. ]+$`)

**Response**

- `pseudonym` — string (1–24 chars, matching `^[\p{L}\p{N}_\-. ]+$`)

## `GET /api/account/export`

**Response**

- object

## `POST /api/account/delete`

**Request**

- object

**Response**

- `participants` — integer (≥ 0)
- `reports` — integer (≥ 0)

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

## `POST /api/account/region`

**Request**

- `region` — `"europe"` | `"americas"` | `"other"`

**Response**

- `region` — `"europe"` | `"americas"` | `"other"`

## `POST /api/quests/claim`

**Request**

- `questId` — string (matching `^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$`)

**Response**

- `questId` — string (matching `^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$`)
- `ruleId` — string (min 1 char)
- `reward` — integer
- `claimedAt` — string (matching `^(?:(?:\d\d[2468][048]|\d\d[13579][26]|\d\d0[48]|[02468][048]00|[13579][26]00)-02-29|\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\d|30)|(?:02)-(?:0[1-9]|1\d|2[0-8])))T(?:(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d+)?)?(?:Z))$`)
