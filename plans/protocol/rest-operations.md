<!-- Generated from the Zod schemas in packages/protocol. Do not edit. -->
<!-- Regenerate with: pnpm --filter @wikifake/protocol docs -->

# REST — probes and schedules

4 routes with no browser at the other end: the
liveness and health probes, the spend report, and the quest cron. The
routes a player calls are in `rest.md` and `rest-account.md`.

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

## `GET /api/cron/quests`

**Response**

- `players` — integer (≥ 0)
- `assigned` — integer (≥ 0)
