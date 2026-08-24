# Phase 3 — Article

| | |
|---|---|
| **State** | in progress |
| **Branch** | `feat/rewrite-phase-3` |
| **Depends on** | phase 2 |
| **Delivers** | `packages/article`: scraping, LLM falsification, Redis cache |

## Objective

Build the package that produces the falsified articles: search and retrieval
through the MediaWiki API directly, paragraph collection with cheerio,
falsification via the AI SDK's `generateObject` validated by Zod, Redis
cache, LLM call counters in the database. Stateless generator, covered by
fixtures of real frozen Wikipedia pages.

## Why now

This is **the** risky phase, and it happens before the API and the UI. The
text ↔ DOM node index parity invariant is the one that cost the worst bug in
the project's history: positions were drawn at random, and the player was
graded on the wrong paragraphs. If that guarantee breaks during the port to
cheerio, better to find out on frozen fixtures than behind three layers of
API and interface. Phase 2 provides the database that the `llm_call` table
needs.

## Steps

### ✅ 3.1 — Fixtures of real frozen Wikipedia pages

Freeze into the package the HTML of real Wikipedia pages, as today: at least
one case with duplicated paragraphs (mobile/desktop variants), one case with
inline tags (`un<b>deux</b>trois`), one case with short paragraphs. They
serve all the following steps.

The fixtures are the first paragraphs of real rendered pages, reduced to keep
them readable in a diff: every paragraph is byte-for-byte as MediaWiki served
it, with its revision recorded. The duplicated-variant case is constructed —
the `action=parse` output does not carry the mobile/desktop duplication — and
says so in the file.

**Done when**: the fixtures are committed and loaded by a first test.

### ✅ 3.2 — MediaWiki client, explicit language and user-agent

Search, page resolution without auto-suggestion, rendered HTML. The language
and the user-agent are **explicit parameters on every call**: today the
Python library carries global state, and the flag-report checker silently
queries Wikipedia in another language depending on call order. Wikipedia
page not found → clean failure, no exception.

Verified while writing it: `flag_verifier.py` never sets either global, so the
failure is not "depending on call order" but "English until the first game is
generated". Recorded as D13.

**Done when**: a test shows two successive calls in two different languages
with no leakage from one to the other, and a page not found produces a typed
failure value, not an exception.

### ✅ 3.3 — Paragraph collection with cheerio

Strict index parity: `paragraphs[i]` corresponds to the i-th collected `<p>`
node, and collection, text extraction and injection share the same node
references. Deduplication of variants, document order preserved, paragraphs
under 50 characters discarded. Spaces inserted between inline tags
("un deux trois") but punctuation not detached ("1889.", not "1889 .").

**Done when**: on every fixture, the index parity, deduplication and
whitespace normalisation tests pass.

### ✅ 3.4 — Falsification via structured output

Structured output from the AI SDK with a Zod schema. **`generateObject` is the
API this sheet was written against and it is deprecated** in the version now
installed: the SDK moved to `generateText` with `Output.object()`. Same
guarantee, different call — worth writing down, because the next reader would
otherwise reach for a deprecated function on the sheet's word.

This removes in one stroke the ~130 lines of parsing heuristics that are
business logic today:
stripping Markdown fences, falling back from the first `[` to the last `]`,
unwrapping an envelope object, all-or-nothing policy on indices, positional
fallback, partial retry. The prompt actually in use is carried over
verbatim; the dead prompt of `core/prompts.py` is not ported. The
1,000-character truncation of the originals sent to the model is **fixed**:
today it silently shortens the long paragraphs being served.

**Done when**: a malformed model output is rejected by the schema (mocked
model in test), and a test checks that a paragraph longer than
1,000 characters goes to the model whole and comes back whole in the
article.

### ✅ 3.5 — Injection and end-to-end parity

`positions` designates exactly the paragraphs the LLM modified.
`false_info_number` sequential from 1 to n, `positions` sorted by ascending
index, 1-based indices in the client contract. The generator is stateless:
two concurrent games do not mutate each other.

**Done when**: on fixtures, an end-to-end test (mocked model) checks that
each position designates a paragraph that differs from the original, and
only those; two concurrent generations exchange no state.

### ✅ 3.6 — Redis cache

Same rules as today: normalised keys ("Paris", "paris", "  PARIS  ",
"PÁRIS" are a single entry, empty category ignored), entries copied on the
way in and on the way out, 6 h TTL, 3 variants per category, 200 categories
in LRU, variants served in rotation. A failed generation is neither cached
nor counted. The cache becomes shared between instances and survives
redeployments.

**The clause to cite is C4**, in `02-contract-transport-and-compliance.md`.
This sheet said "§3.4" four times; `C3.4` is paragraph deduplication, so
anyone following the sheet landed on the wrong guarantee. Corrected here.

"Same rules as today" turned out to need a decision twice, because the
current code is weaker than the text it is supposed to implement. Both are
recorded as D14; in the target the contract wins:

- **Rotation.** The Python calls `random.choice`, so nothing stops one
  variant being served ten times running — C4.4 holds only in expectation,
  and the test only asserts that two different seeds can differ. Redis has
  `INCR`: the target rotates, and serves every variant once per cycle.
- **Copies.** `_copy` copies three known keys one level deep and shares
  everything below them. Storing JSON makes every read its own object graph,
  so C4.2 holds for the whole payload rather than for the three fields the
  test happens to poke.

The token usage is deliberately **not** cached. A game served from the cache
cost nothing, and replaying the tokens of the generation that filled the
entry would inflate `perGeneratedGame` by however often it was reused — the
exact dilution C4.6 exists to prevent.

A lookup has **three** outcomes, not two: hit, miss, and unavailable. An
outage counted as a miss would make `cacheHitRate` partly a measure of Redis
uptime, and would bill a run of generations to a cache that was simply down
with nothing in the numbers saying so.

The rules are enforced by three Lua scripts rather than command sequences.
The reason for moving to Redis at all is that the cache becomes shared, and
a read that filters expired entries, bumps a counter and touches an LRU index
is four commands: two instances interleaving them serve one variant twice or
evict a category the other just wrote. The Python held a `threading.Lock` for
that and only had to defend against its own threads.

The driver is a **devDependency**: `createArticleCache` takes a
`RedisCommands` port, as `mediawiki.ts` takes a `WikiTransport`, so nothing
that consumes the package at runtime drags a Redis client along. The
concrete client is wired in phase 4.

**Done when**: the cache rules of C4 pass in integration tests against a
local Redis, including mutating the result of a `get`.

### 3.7 — Counters in the database

Every LLM call writes an `llm_call` row (model, call type, input/output
tokens, failure). `cache_hit_rate` and `per_generated_game` — cost per
actually generated game, not diluted by the cache — become queries.

**Done when**: after one successful and one failed generation in an
integration test, `llm_call` carries both rows, and `per_generated_game`
counts only the successful one.

## Exit gate

- Index parity and non-duplication verified on real HTML fixtures.
- Cache rules of C4 verified against Redis.
- Stateless generator; clean Wikipedia failure, neither cached nor counted.
- No API or UI code: the package is used only from its tests.

## Contract touched

See `01-contract-to-preserve.md`: **article generation** (§3.3 — index
parity, exact `positions`, deduplication, whitespace normalisation,
stateless generator, clean failure) and, in
`02-contract-transport-and-compliance.md`, **cache and accounting** (C4 —
key normalisation, copies, TTL, rotation, `cache_hit_rate`,
`per_generated_game`).

## Pitfalls

- **The parity test first.** It is the piece to write first; the whole rest
  of the chain rests on it.
- Cheerio lets node references be shared, but only if collection, extraction
  and injection work on the same tree: an intermediate re-parse silently
  recreates the historical bug.
- **Do not touch the prompt.** `generateObject` may already change the
  model's behaviour; compare on a fixed set of categories before any tweak.
  Do not mix a stack change with a behaviour change.
- Do not port `core/prompts.py`: it is dead code, the real prompt is inline
  in `misinformation.py`.
- The falsifiability threshold exists twice today (settings and hardcoded in
  `misinformation.py`): a single constant in the target. **Done in 3.4** —
  `MIN_FALSIFIABLE_CHARS` in `packages/article`.
