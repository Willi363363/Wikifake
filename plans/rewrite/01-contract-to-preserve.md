# The contract to preserve — 1/2

> Server authority, scoring, article generation, known defects. The rest —
> cache and accounting, transport, compliance, deployment identity,
> documentation lock — is in `02-contract-transport-and-compliance.md`.

This is the most important document in the repository. The current tests are
not decorative coverage: every guarantee below locks in a non-regression that
cost a bug in production. **Every guarantee must have an equivalent test in
the new stack before the Python is deleted** — that is the entry condition of
phase 10 (cutover). The Python stays as long as a single line has no tested
equivalent.

The identifiers (`C1.1`, `C2.3`, …) are stable and citable: the phase files
refer to them, and a guarantee never changes number.

## Section index

| Id | Section | File |
|---|---|---|
| C1 | Server authority | this file |
| C2 | The scoring scale | this file |
| C3 | Article generation | this file |
| D | Known defects to fix | this file |
| C4 | Cache and accounting | `02-contract-transport-and-compliance.md` |
| C5 | Transport robustness | `02-contract-transport-and-compliance.md` |
| C6 | CC BY-SA compliance and indexing | `02-contract-transport-and-compliance.md` |
| C7 | Deployment identity | `02-contract-transport-and-compliance.md` |
| C8 | Documentation ↔ code lock | `02-contract-transport-and-compliance.md` |

## C1 — Server authority: the solution never leaves the server

- **C1.1** — The start payload (`game_start`, `POST /api/game/start`)
  contains the article and the **number** of falsified paragraphs. Never
  which ones, never the explanations, never the hints, never `original_text`
  (a diff was enough to solve the game). Verified by keys **and by values**:
  no truth text and no hint text may appear in the serialised JSON.
- **C1.2** — The complete solution arrives with `game_end` / the response of
  `POST /api/game/submit`, never before.
- **C1.3** — The score is computed by the server from its own state.
  Penalties declared by the client are ignored: `hintsUsed: 9`,
  `hintPenalty: 9999`, `scoreStolen: -100000` must produce a breakdown of
  zero.
- **C1.4** — Hints are billed per call, levels are **monotonic** and billed
  only once: level 2 unlocked then level 1 requested again returns level 2;
  repeating level 2 does not bill again. The text of a hint is never
  transmitted before payment.
- **C1.5** — Score stealing and hint blocking are enforced server-side.
  `HINT_LOCK` refuses the purchase with `code: hints_blocked` and
  `hint_levels` stays empty.
- **C1.6** — The SCANNER item is resolved by the server: it designates a real
  fake not yet designated, remembered per player, and returns `null` when
  none are left.
- **C1.7** — The host role is decided and verified server-side.
  `force_start`, `force_pick`, `start_game` return `code: not_host` to a
  guest, without changing the room state. A guest changes their `ready` but
  neither `time_limit` nor `with_items`.
- **C1.8** — When the host leaves, the next player is promoted. The room
  disappears when the last player leaves.

## C2 — The scoring scale

- **C2.1** — `score = tp×150 − fp×80 − hint_penalty − score_stolen + time_bonus`
  with `time_bonus = max(0, time_limit − elapsed) × 0.5`, `HINT_COST = 50`,
  `REVEAL_COST = 200`, `STEAL_AMOUNT = 50`.
- **C2.2** — Hint cost is **non-cumulative** (level 2 costs 200 in total, not
  250) and monotonic.
- **C2.3** — The score can be negative. No time bonus beyond the time limit.
- **C2.4** — Leaderboard sorted by descending score.
- **C2.5** — Reference case to keep as a test: `tp=3, fp=1, penalty=20,
  stolen=50, 200 s left of 300 → 400`.

## C3 — Article generation

- **C3.1** — **`positions` designates exactly the paragraphs the LLM
  modified.** This was the most serious bug in the project's history: the
  positions were drawn at random and the player was graded on the wrong
  paragraphs.
- **C3.2** — Strict index parity: `paragraphs[i]` corresponds to the i-th
  collected `<p>` node. The whole chain rests on this.
- **C3.3** — `false_info_number` sequential from 1 to n, `positions` sorted
  by ascending index, indices **1-based** in the client contract.
- **C3.4** — Paragraphs deduplicated (Wikipedia mobile/desktop variants),
  document order preserved, paragraphs under 50 characters discarded.
- **C3.5** — Spaces inserted between inline tags (`un<b>deux</b>trois` →
  "un deux trois") but punctuation not detached ("1889." not "1889 .").
- **C3.6** — The generator is **stateless**: two concurrent games do not
  mutate each other.
- **C3.7** — Wikipedia not found → clean failure, no exception, no caching.

## D — Known defects to fix during the rewrite

The flip side of the contract: verified bugs, present in production today,
that the rewrite must close — not reproduce. They are not collateral damage
of the migration.

- **D1** — The items feature is broken in multiplayer:
  `frontend/src/features/game/GameSession.jsx:376` passes `onUse={useItem}`
  while `useItem` is neither imported nor defined — a `ReferenceError` when
  rendering any round with `withItems` — and nothing ever calls
  `setItemModal`. The smoke test does not catch it: it renders with
  `withItems: false`. To be rebuilt, not ported.
- **D2** — Penalties leak from one round to the next: the topic-vote path —
  the normal path — does not purge `hint_levels`, `score_stolen`,
  `hints_blocked_until`, `scanned`, unlike `reset_round()`.
  `test_score_integrity.py` does not see it: it tests `reset_round()` in
  isolation. A single round-start path in the target.
- **D3** — Two diverging start paths: `handle_start_game` generates the
  article synchronously on the event loop (blocking every room) and announces
  `players` as a list of nicknames; `start_game_in_room` generates in a
  thread and announces `{name, color}` objects. The client has to accept
  both shapes.
- **D4** — The server never enforces the end of a round: `time_limit` is only
  applied by the client; if the last non-submitted player disconnects, the
  room stays in `playing` indefinitely. No room TTL either.
- **D5** — The reconnection path is dead: nothing ever sets `connected` to
  `False`, disconnection deletes the player. Score, items and paid hints are
  lost, and the nickname is immediately reclaimable by a third party.
- **D6** — `live_score` is neither validated nor throttled and is rebroadcast
  to the whole room: an amplification vector. The `targets` of a `use_item`
  are not validated (self-targeting, unbounded target count). `set_ready`
  accepts a `time_limit` from the host mid-round, which changes the time
  bonus of subsequent submissions.
- **D7** — `FREEZE_TIME` has no server effect: the −10 s are purely visual
  and do not cut into the time bonus. The item does nothing of what it
  announces.
- **D8** — Duplicated truths: the scoring scale exists twice
  (`backend/src/scoring.py` and `frontend/src/config.js`), item identifiers
  are synchronised by hand, `MIN_FALSIFIABLE_CHARS` is redeclared as a
  hard-coded value in `misinformation.py`, and `backend/src/core/prompts.py`
  is dead code — the real prompt is inline in `misinformation.py`.
- **D9** — Client-side leaks: the cursors of departed players are never
  removed from the state; `useHints` resets on `totalFakes`, which only holds
  because `GameSession` is unmounted between rounds.
- **D10** — The nickname is not encoded in the WebSocket URL even though the
  server regex allows spaces.
- **D11** — A duplicate mark is scored twice: `check_answer` counts every
  element of the submitted list, so marking the same paragraph three times
  counts three true positives — 450 points for one paragraph. Nothing on the
  wire forbids the repeat. Closed by the grading of phase 1 step 1.6, which
  counts a paragraph once.
- **D12** — The flag verification is never counted: `flag_verifier.py` calls
  the model on every report and does not call `record_call`, so `/api/usage`
  under-reports the spend and the cost of the feature is invisible. Closed by
  the `llm_call` table of phase 2 step 2.5.
- **D13** — The flag verification asks the wrong Wikipedia: the language and
  user agent are module globals set only by `scraper.py`, so before the first
  generation of a fresh process the checker queries the **English** Wikipedia
  with the library's default agent. It also resolves pages with
  auto-suggestion on, so a lookup can land on a different article. Closed by
  the MediaWiki client of phase 3 step 3.2, where both are per-call
  parameters.

- **D14** — The cache does not do what C4 says, in four ways: rotation is
  `random.choice` and not a rotation (C4.4); `_copy` copies three keys one
  level deep and shares everything below them (C4.2); a category whose
  entries have all expired stays in the LRU list forever, so the "200
  categories" bound starts evicting live categories to make room for phantoms
  (C4.3); and `stats()` counts expired entries that `get` and `put` filter, so
  the number `/api/usage` publishes outlives what the cache will serve.
  Closed by the Redis cache of phase 3 step 3.6, where rotation is an `INCR`,
  the copy is a JSON round trip, and the index and the store are deleted
  together.

The rest of the contract — C4 to C8 — is in
`02-contract-transport-and-compliance.md`.
