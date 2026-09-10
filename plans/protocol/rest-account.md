<!-- Generated from the Zod schemas in packages/protocol. Do not edit. -->
<!-- Regenerate with: pnpm --filter @wikifake/protocol docs -->

# REST — the account

8 routes about the account rather than the round:
the pseudonym, the export and the erasure, the region, the cosmetics and
the shop. The round is in `rest.md`.

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

## `POST /api/account/region`

**Request**

- `region` — `"europe"` | `"americas"` | `"other"`

**Response**

- `region` — `"europe"` | `"americas"` | `"other"`

## `GET /api/account/cosmetics`

**Response**

- `marker` — string | null
- `markStyle` — string | null
- `frame` — string | null
- `owned` — array of string

## `POST /api/account/cosmetics`

**Request**

- one of 2 shapes

**Response**

- `marker` — string | null
- `markStyle` — string | null
- `frame` — string | null

## `POST /api/shop/buy`

**Request**

- `cosmeticId` — string (1–64 chars)

**Response**

- `cosmeticId` — string
- `spent` — integer (≥ 0)
- `balance` — integer
- `already` — boolean

## `POST /api/quests/claim`

**Request**

- `questId` — string (matching `^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$`)

**Response**

- `questId` — string (matching `^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$`)
- `ruleId` — string (min 1 char)
- `reward` — integer
- `claimedAt` — string (matching `^(?:(?:\d\d[2468][048]|\d\d[13579][26]|\d\d0[48]|[02468][048]00|[13579][26]00)-02-29|\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\d|30)|(?:02)-(?:0[1-9]|1\d|2[0-8])))T(?:(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d+)?)?(?:Z))$`)
