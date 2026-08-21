# Phase 3 — Article

| | |
|---|---|
| **State** | to do |
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

### 3.1 — Fixtures of real frozen Wikipedia pages

Freeze into the package the HTML of real Wikipedia pages, as today: at least
one case with duplicated paragraphs (mobile/desktop variants), one case with
inline tags (`un<b>deux</b>trois`), one case with short paragraphs. They
serve all the following steps.

**Done when**: the fixtures are committed and loaded by a first test.

### 3.2 — MediaWiki client, explicit language and user-agent

Search, page resolution without auto-suggestion, rendered HTML. The language
and the user-agent are **explicit parameters on every call**: today the
Python library carries global state, and the flag-report checker silently
queries Wikipedia in another language depending on call order. Wikipedia
page not found → clean failure, no exception.

**Done when**: a test shows two successive calls in two different languages
with no leakage from one to the other, and a page not found produces a typed
failure value, not an exception.

### 3.3 — Paragraph collection with cheerio

Strict index parity: `paragraphs[i]` corresponds to the i-th collected `<p>`
node, and collection, text extraction and injection share the same node
references. Deduplication of variants, document order preserved, paragraphs
under 50 characters discarded. Spaces inserted between inline tags
("un deux trois") but punctuation not detached ("1889.", not "1889 .").

**Done when**: on every fixture, the index parity, deduplication and
whitespace normalisation tests pass.

### 3.4 — Falsification via `generateObject`

`generateObject` from the AI SDK with a Zod schema. This removes in one
stroke the ~130 lines of parsing heuristics that are business logic today:
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

### 3.5 — Injection and end-to-end parity

`positions` designates exactly the paragraphs the LLM modified.
`false_info_number` sequential from 1 to n, `positions` sorted by ascending
index, 1-based indices in the client contract. The generator is stateless:
two concurrent games do not mutate each other.

**Done when**: on fixtures, an end-to-end test (mocked model) checks that
each position designates a paragraph that differs from the original, and
only those; two concurrent generations exchange no state.

### 3.6 — Redis cache

Same rules as today: normalised keys ("Paris", "paris", "  PARIS  ",
"PÁRIS" are a single entry, empty category ignored), entries copied on the
way in and on the way out, 6 h TTL, 3 variants per category, 200 categories
in LRU, variants served in rotation. A failed generation is neither cached
nor counted. The cache becomes shared between instances and survives
redeployments.

**Done when**: the cache rules of §3.4 of the contract pass in integration
tests against a local Redis, including mutating the result of a `get`.

### 3.7 — Counters in the database

Every LLM call writes an `llm_call` row (model, call type, input/output
tokens, failure). `cache_hit_rate` and `per_generated_game` — cost per
actually generated game, not diluted by the cache — become queries.

**Done when**: after one successful and one failed generation in an
integration test, `llm_call` carries both rows, and `per_generated_game`
counts only the successful one.

## Exit gate

- Index parity and non-duplication verified on real HTML fixtures.
- Cache rules of §3.4 verified against Redis.
- Stateless generator; clean Wikipedia failure, neither cached nor counted.
- No API or UI code: the package is used only from its tests.

## Contract touched

See `01-contract-to-preserve.md`: **article generation** (§3.3 — index
parity, exact `positions`, deduplication, whitespace normalisation,
stateless generator, clean failure) and **cache and accounting** (§3.4 —
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
  `misinformation.py`): a single constant in the target.
