# Phase 3 — steps: cache and accounting

> Steps 3.6 and 3.7. The phase sheet, its exit gate and where each step stands:
> `phase-03-article.md`. Retrieval and falsification:
> `phase-03-steps-generation.md`.
>
> The contract clause both steps answer to is **C4**, in
> `02-contract-transport-and-compliance.md`.

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

### ✅ 3.7 — Counters in the database

Every LLM call writes an `llm_call` row (model, call type, input/output
tokens, failure). `cache_hit_rate` and `per_generated_game` — cost per
actually generated game, not diluted by the cache — become queries.

This changed the signature of both `falsify` and `generateArticle`, and that
was the point. They used to return a `Result`, so a failed call took its cost
with it into the error path — which is exactly how `usage.py` loses its
failures and how `flag_verifier.py` loses its calls entirely (D12). They now
return the outcome **and** the call records, on every path.

Reading C4.5 precisely matters here. "Neither cached nor counted" means not
counted **as a generated game**; the call itself is recorded, because it cost
money. So a call that threw is a row with `failed: true`, and a call the model
answered but whose answer we then reject is a row with `failed: false` — the
tokens were spent either way. What a failure does not produce is a `game`
row, and that absence is what keeps it out of `perGeneratedGame`.

`llm_call_kind` moves to `@wikifake/protocol`, with the shape of a call
record beside it. Without that, this step would have created a third copy of
"what a call was for": the Postgres enum, the key of `byKind` on
`/api/usage`, and whatever the generator labelled its own calls. `byKind` was
`z.record(z.string(), …)` and is now a `partialRecord` over the enum, so the
generated documentation names the three kinds instead of saying "string".

`recordLlmCalls` is the single writer, so "every call writes a row" is one
statement rather than a rule each caller has to remember.

The integration test lives in `packages/db`, which takes `@wikifake/article`
as a **devDependency**. This package owns the database — one truncation
policy, one file at a time — and putting a database test in `article` would
have had two packages truncating the same tables under Turbo's parallelism.
`workspace-graph.test.ts` now asserts that arrow explicitly: `db` may read
`article` in a test and never at runtime.

**Done when**: after one successful and one failed generation in an
integration test, `llm_call` carries both rows, and `per_generated_game`
counts only the successful one.
