# Current state — known debt

**This file is the debt register.** Any problem discovered along the way —
during the rewrite, a review or a debugging session — is recorded here with
its `file:line` reference, **without fixing it** in passing: the fix happens
in the rewrite phase it belongs to, not as an aside.

## The defects verified in production

1. **The items feature is broken in multiplayer.**
   `frontend/src/features/game/GameSession.jsx:376` passes `onUse={useItem}`
   while `useItem` is neither imported nor defined — a `ReferenceError` when
   rendering any round with `withItems`. And nothing ever calls
   `setItemModal`, so the chain "click on an item → pick the target →
   `use_item`" has no entry point. The smoke test does not catch it: it
   renders with `withItems: false`.

2. **Penalties leak from one round to the next.**
   `backend/src/realtime/themes.py:101-106` only resets
   `score/answered/results/ready/items`, whereas
   `backend/src/realtime/handlers.py:128` calls `reset_round()`, which also
   purges `hint_levels`, `score_stolen`, `hints_blocked_until`, `scanned`.
   The theme-vote path — the normal path — therefore leaves hint penalties
   and score thefts lying around. `test_score_integrity.py` does not see it:
   it tests `reset_round()` in isolation, never the real path.

3. **Two divergent start paths.** `handle_start_game`
   (`backend/src/realtime/handlers.py:118`) generates the article
   **synchronously on the event loop** (blocking every room during
   scraping + LLM) and announces `players` as a list of nicknames
   (`handlers.py:146`); `start_game_in_room`
   (`backend/src/realtime/themes.py:93`) generates in a thread and announces
   `{name, color}` objects (`themes.py:123`). The client has to accept both
   shapes.

4. **The server never enforces the end of the round.** `time_limit` is only
   applied by the client — the server only uses it for the time bonus
   (`backend/src/realtime/handlers.py:371`). If the last player who has not
   submitted disconnects, the room stays in `playing` indefinitely. No room
   TTL either: an inactive room lives forever.

5. **The reconnection path is dead.**
   `backend/src/realtime/ws.py:58-65` provides for recovering a player whose
   `connected` is `False`, but nothing ever sets that field to `False` —
   disconnection removes the player (`ws.py:117`). Score, items and paid
   hints are lost, and the nickname is immediately claimable by a third
   party.

6. **Unvalidated WebSocket inputs.** `live_score`
   (`backend/src/realtime/handlers.py:152`) is neither validated nor
   throttled and is rebroadcast to the whole room: an amplification vector.
   The `targets` of a `use_item` (`handlers.py:229`) are not validated
   (self-targeting, unrestricted number of targets). `set_ready` accepts a
   `time_limit` from the host **mid-round** (`handlers.py:56-57`), which
   changes the time bonus of subsequent submissions.

7. **`FREEZE_TIME` has no server-side effect.** The item is declared
   (`backend/src/realtime/items.py:14`) but `_apply_scoring_effect`
   (`backend/src/realtime/handlers.py:219-222`) only handles `SCORE_STEAL`
   and `HINT_LOCK`: the −10 s are purely visual and do not cut into the time
   bonus. The item does none of what it announces.

8. **Duplicated truths.** The scoring rules exist twice
   (`backend/src/scoring.py` and `frontend/src/config.js`). The item
   identifiers are synchronised by hand between
   `backend/src/realtime/items.py` and
   `frontend/src/features/items/catalog.js`. `MIN_FALSIFIABLE_CHARS`
   (`backend/src/core/settings.py:59`) is redeclared hard-coded in
   `backend/src/core/misinformation.py:14` (`MIN_PARAGRAPH_LENGTH = 100`).
   `backend/src/core/prompts.py` is dead code: the real falsification prompt
   is inline in `misinformation.py`.

   Since phase 1 step 1.4, the scoring copies can no longer *diverge* in
   silence: `packages/domain/src/scale-parity.test.ts` asserts all three agree
   with `C2.1`. They still exist in three places — the duplication goes with the
   frontend in phase 8 and the Python in phase 10 — but a disagreement now fails
   CI instead of surfacing as an unexplainable debrief.

9. **Client-side leaks.** The cursors of departed players are never removed
   from the state (`frontend/src/features/game/useLiveCursors.js`).
   `useHints` resets on `totalFakes`
   (`frontend/src/features/game/useHints.js:33`), which only works because
   `GameSession` is unmounted between rounds.

10. **The nickname is not encoded** in the WebSocket URL
    (`frontend/src/lib/ws.js:13`) while the server regex allows spaces.

11. **A duplicate mark is scored twice.** `check_answer`
    (`backend/src/core/verification.py:1`) walks the submitted list and counts
    every element, so marking the same paragraph three times counts three true
    positives — 450 points for one paragraph. Nothing on the wire forbids the
    repeat: the message carries a plain list. Found while writing the grading
    rules of phase 1 step 1.6, which count a paragraph once.

12. **The flag verification is never counted.** `flag_verifier.py:44` calls the
    model on every player report and does not call `record_call`, unlike the
    scraper and the falsifier. So `/api/usage` under-reports the model spend by
    however many reports came in, and the cost of the feature is invisible.
    Found while writing the `llm_call` table of phase 2 step 2.5, whose `kind`
    enum has a value for it.

13. **The flag verification asks the wrong Wikipedia.** The `wikipedia` library
    keeps the language and the user agent in module globals, and only
    `scraper.py:96` ever sets them. `flag_verifier.py:27` never does, so it uses
    whatever the last caller configured — and on a freshly restarted process,
    before any game has been generated, that is the **English** Wikipedia with
    the library's default user agent, which Wikimedia's policy refuses. A report
    about a French article then gets fact-checked against the wrong encyclopedia,
    or against nothing. The same function also calls
    `wikipedia.page(results[0])` without `auto_suggest=False`, so a lookup can
    land on a different article than the one searched for.

14. **The cache does not do what it says, in four ways.** Found while porting it
    to Redis in phase 3 step 3.6; all four are closed by that port.

    - **Rotation is a coin toss.** `article_cache.py:82` reads
      `chosen = (rng or random).choice(entries)`. C4.4 says the variants are
      "served in rotation"; nothing stops one variant being returned ten times
      running. `test_several_variants_are_reachable`
      (`backend/tests/test_article_cache.py:101`) asserts only that thirty
      *different seeds* do not all agree, which a pure random picker satisfies.
    - **The copy is not a copy.** `_copy` (`article_cache.py:104-111`) rebuilds
      exactly three known keys one level deep. Anything nested below a
      `positions` element, and any mutable value under a key added later, is
      shared by reference between the store and every game holding it. C4.2's
      "mutating the result of a `get` affects nothing else" is true only for the
      three fields the test happens to poke.
    - **The LRU bound applies to phantoms.** When every entry for a category has
      expired, `get` does `_store.pop(key, None)` and returns
      (`article_cache.py:76-79`) **before** reaching `_touch`, so the key stays
      in `_recent` forever. Once that list hits
      `ARTICLE_CACHE_MAX_CATEGORIES`, eviction starts consuming keys the store
      no longer holds while live categories survive, and `stats()["categories"]`
      and the LRU list disagree about what the cache contains.
    - **The published count outlives the entries.** `stats()`
      (`article_cache.py:118`) sums raw list lengths with no `expired` filter,
      unlike `get` and `put`. The `cache` block that `/api/usage` serves
      (`backend/src/api/health.py:56`) therefore reports articles the cache
      would refuse to hand out.

## The structural debt is its own file

The entries above are defects with a `file:line`. The notes that are about the
*shape* of the repository — a bundler we cannot use yet, two notations for one
contract — are in `06-structural-debt.md`, because this file reached the
200-line limit and squeezing a document is how it stops being read.

A finding recorded on the way through goes in whichever of the two it belongs
to. Both are the debt register.
