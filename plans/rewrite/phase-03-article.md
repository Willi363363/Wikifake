# Phase 3 — Article

| | |
|---|---|
| **State** | in progress — all seven steps done, exit gate passed |
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

Seven steps in one package, so the definitions live in two sheets: the chain
that turns a Wikipedia page into a round, and the two that make it cheap and
accountable. **The tables below are the only place that says where a step
stands** — the sheets define the work and its completion criterion, and carry
no state.

| # | Step — retrieval and falsification | State |
|---|---|---|
| 3.1 | Fixtures of real frozen Wikipedia pages | ✅ done |
| 3.2 | MediaWiki client, explicit language and user-agent | ✅ done |
| 3.3 | Paragraph collection with cheerio | ✅ done |
| 3.4 | Falsification via structured output | ✅ done |
| 3.5 | Injection and end-to-end parity | ✅ done |

Definitions: `phase-03-steps-generation.md`.

| # | Step — cache and accounting | State |
|---|---|---|
| 3.6 | Redis cache | ✅ done |
| 3.7 | Counters in the database | ✅ done |

Definitions: `phase-03-steps-cache.md`.

The order is the order the work had to happen in: the parity of 3.3 is what
the whole chain rests on, and nothing above it was worth caching until it was
right.

## Exit gate

- Index parity and non-duplication verified on real HTML fixtures. ✅
- Cache rules of C4 verified against Redis. ✅
- Stateless generator; clean Wikipedia failure. ✅ — and **half** of "neither
  cached nor counted": a failed generation is not counted as a generated game,
  which is tested. Not *cached* is a property of the caller, which does not
  exist until phase 4: nothing here calls `put`, so nothing here can cache a
  failure. What phase 3 delivers is a failure that is distinguishable and that
  carries its own call record; wiring the two so that a failure cannot reach
  the cache is phase 4's first job, and it should not be assumed done.
- No API or UI code: the package is used only from its tests. ✅

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
