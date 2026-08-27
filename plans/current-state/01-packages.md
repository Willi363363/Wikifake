# Current state — the packages

Seven packages under `packages/`, consumed by two applications. Two of them
carry a ★, and they are the reason the rewrite happened: they hold each truth
**once**. The old stack held the scoring scale in three places, the item
identifiers in two, and two different shapes of `players` in one message —
synchronised by hand, and therefore not synchronised.

## ★ `protocol` — every contract, as Zod

One schema per WebSocket message and per REST DTO. The server validates on
input, the client infers its types from the same object, and neither can hold a
shape the other does not.

| Module | Holds |
|---|---|
| `primitives.ts` | The bounded values: nickname, room code, chat content, cursor coordinate, paragraph index, hint level |
| `ws/incoming.ts` | The thirteen client messages, as a discriminated union; `INCOMING_TYPES` |
| `ws/outgoing.ts` | The fifteen server messages; `OUTGOING_TYPES` |
| `rest/routes.ts` | The REST surface as data: method, path, request and response schema |
| `errors.ts` | The error codes, as a **closed** union |
| `items.ts` | `ITEM_IDS` — the thirteen items, named once |
| `docs/` | The generator that writes `plans/protocol/` |
| `decode.ts` | One decode entry point, returning a result rather than throwing |

Two things follow from the union being the union:

- **`incomingMessage` is the dispatch table.** `apps/realtime/src/frames.ts`
  decodes every frame with it, and the reducer switches over the union with no
  `default` branch — so a message added to the schema and not handled is a
  compile error. The old stack had a `HANDLERS` dict that could drift from its
  documentation, which is why a test used to compare them.
- **The documentation cannot lie.** `plans/protocol/` is generated from these
  schemas and `docs/docs.test.ts` compares the generated pages to the committed
  ones. Changing a contract without regenerating fails `pnpm test`.

`solution-never-leaks.test.ts` is the schema-level half of C1: the start
payload's own type has nowhere to put a solution.

## ★ `domain` — the rules, pure

No I/O, no clock, no network. `purity.test.ts` enforces that by refusing an
import of anything that would supply one.

| Module | Holds |
|---|---|
| `scoring.ts` | The scale: `tp×150 − fp×80 − hints − stolen + bonus`, the constants, the breakdown |
| `grading.ts` | Answer grading — a paragraph marked three times counts once (D11) |
| `hints.ts` | The ledger: monotonic levels, non-cumulative cost, billed once |
| `items.ts` | The catalogue and the effects, including the four that touch server state |
| `room/` | The room as a reducer: `(state, event) → {state, effects}` |

The reducer is the piece worth understanding. `room/reduce.ts` decides; it
never acts. It returns effects — `broadcast`, `send`, `arm_timer`,
`generate_article`, `close_room` — and `apps/realtime` performs them. So a
four-player round with items, a reconnection inside its grace window and a
round ending by timeout are all testable with fake clocks and no socket, no
Redis and no model. `room/scenario.ts` is the harness those tests are written
against.

Every outbound message the reducer builds is typed `OutgoingMessage`, so the
server *cannot* emit a type the catalogue does not describe. The other
direction — a catalogue entry nobody sends — is what
`apps/realtime/src/catalogue-parity.test.ts` checks.

## `article` — Wikipedia in, falsification out

`mediawiki.ts` fetches through the MediaWiki API; `paragraphs.ts` collects the
`<p>` nodes with cheerio. **Index parity lives here**, and it is the project's
historic bug: `paragraphs[i]` is the i-th collected node, deduplicated across
Wikipedia's mobile and desktop variants, in document order, with paragraphs
under 50 characters dropped and spaces inserted between inline tags without
detaching punctuation. `paragraphs.test.ts` asserts it against frozen HTML
fixtures, which is why they are excluded from Prettier: reformatting them would
change the text the parity test reads.

`falsify.ts` calls the model through the AI SDK with `generateObject` and a Zod
schema, so a malformed answer is a validation failure rather than a bad round.
`generate.ts` composes the two and is **stateless** — two concurrent games
cannot touch each other. `cache/` is the Redis cache: normalised keys, copies
in and out by JSON round trip, 6 h TTL, three variants rotated by `INCR`, 200
categories in LRU, and a failed generation neither cached nor counted.
`verify.ts` is the fact-check behind a player's error report, with the language
and user agent passed per call rather than read from a module global (D13).

## `db` — Drizzle, and the solution's home

Fourteen tables: `user`, `session`, `account`,
`verification` (Better Auth's own), `profile`, `room`, `game`, `gamePosition`,
`participant`, `answer`, `hintPurchase`, `itemUse`, `flagReport`, `llmCall`.
Five schema files, six migrations.

Two of them earn a note. **`gamePosition` is the solution**, written when the
round is generated and read when it is submitted; a `0`-based index is refused
by a constraint, because the client contract is 1-based (C3.3). **`llmCall`** is
what makes the cost of a game a query instead of a counter that a restart
zeroes — the old stack had the counters and lost them on every deploy, and did
not count the fact-check calls at all (D12).

`queries/` is the only place SQL is written; nothing above it composes a query.

## `ui` — the design system

Tailwind v4, with the current visual identity in `theme.css` as tokens rather
than the ~430 inline style objects and ~1,300 lines of global CSS it replaces.
shadcn-shaped primitives — button, badge, input, label, progress, separator,
dialog — plus `ParagraphToken`, the one component the game is actually played
with, which is a `<button>` and not a `<span onClick>`.

`contrast.ts` audits the palette against WCAG and a test fails on a pair that
does not pass. `motion.ts` names every keyframe, and every animation that
flashes or displaces the page is switched off **by name** under
`prefers-reduced-motion: reduce` — the photosensitivity stake is real, and a
blanket `animation: none` would also kill the fades. `buttonVariants` sits
outside the `'use client'` boundary so a Server Component can call it.

## `env` and `config`

`env` validates the whole environment through one Zod schema and fails at
startup with every missing variable named, rather than at the first use of one.
Two consumers read variables *without* it, deliberately: `deployment.ts` and
`indexing.ts`, because a health probe that refuses to answer without a working
database goes silent exactly when somebody needs it.

`config` holds the shared tsconfig, ESLint and Vitest presets, and two tests
that keep the workspace honest: every package extends the shared tsconfig, and
the dependency graph has no cycle.
