# Phase 10 — the contract, checked off against the new stack

> The grid the entry condition of phase 10 asks for: every guarantee of
> `01-contract-to-preserve.md` and `02-contract-transport-and-compliance.md`
> pointing at a named test that runs in CI. Steps 10.1 to 10.8 are read here;
> their state is in `phase-10-cutover.md`, like every other step's.

A cell is a file and a case, never "covered somewhere". Where several tests
hold a line, the first named is the one that would fail first.

## C1 — Server authority

| Id | Test |
|---|---|
| C1.1 | `apps/web/app/api/game/start/route.test.ts` — “C1.1 — the solution stays on the server”: *carries no forbidden key*, *carries no truth text, no hint text and no original paragraph*. Also `packages/protocol/src/ws/outgoing.test.ts` — “game_start cannot carry the solution (C1.1)”, `packages/protocol/src/solution-never-leaks.test.ts` — “the round-start payload cannot carry the solution”, and the four e2e specs' negative assertions |
| C1.2 | `apps/web/app/api/game/submit/route.test.ts` — “C1.2 — the solution arrives here, and only here”: *carries every falsification in full*, *never arrives before, however the round is poked at*. Also `packages/protocol/src/solution-never-leaks.test.ts` — “the solution arrives at the end, and only there (C1.2)” |
| C1.3 | `apps/web/app/api/game/submit/route.test.ts` — “C1.3 — a client cannot declare its own penalty”: *produces a breakdown of zero from a payload that claims otherwise*. Also `packages/domain/src/hints.test.ts` — “C1.3 — a client cannot declare its own penalty”, `apps/realtime/src/authority.test.ts` — *bills the hints it sold, whatever the client declares* |
| C1.4 | `packages/domain/src/hints.test.ts` — “C1.4 — levels are monotonic” and “C1.4 — a hint is never transmitted before payment”. Billing per call: `apps/web/app/api/game/hint/route.test.ts` — “C1.4 — billed on call, and only once”: *does not bill the same reveal twice*, *bills once when two identical requests race*. Persistence: `packages/db/src/queries/session.test.ts` — “C1.4 — billing a hint” |
| C1.5 | `packages/domain/src/items.test.ts` — “C1.5 — HINT_LOCK” and “C1.5 — SCORE_STEAL”. Applied server-side: `packages/domain/src/room/round-actions.test.ts` — *C1.5 — refuses while HINT_LOCK is in effect, and bills nothing*, *C1.5 — SCORE_STEAL is applied server-side*. The code itself is in the closed union: `packages/protocol/src/errors.test.ts` |
| C1.6 | `packages/domain/src/items.test.ts` — “C1.6 — the SCANNER”. Resolved server-side and remembered per player: `apps/web/app/api/game/scan/route.test.ts` — “C1.6 — a real fake, not yet designated”: *never points at the same paragraph twice*, *answers null once there is nothing left to point at*, *remembers designations across a rebuilt handler*. Also `packages/db/src/queries/session.test.ts` — “C1.6 — what the scanner has already designated” |
| C1.7 | `packages/domain/src/room/lobby.test.ts` — “C1.7 — host-only commands” and “C1.7 — the options belong to the host”. Over the wire: `apps/realtime/src/authority.test.ts` — “C1.7 — the host decides, and a refusal decides nothing”: *refuses force_start to a guest without touching the room*, *refuses start_game…*, *refuses force_pick…*, *takes a guest ready and drops the options riding with it* |
| C1.8 | `apps/realtime/src/authority.test.ts` — *promotes the next player when the host is gone*, and “C1.8, D4 — the room ends”: *forgets the state and the row when the last player is evicted*. Also `packages/domain/src/room/membership.test.ts` — “C1.8 — the host”, `apps/realtime/src/rooms/store.test.ts` — “C1.8 — the room ends when the last player is evicted” |

## C2 — The scoring scale

| Id | Test |
|---|---|
| C2.1 | `packages/domain/src/scoring.test.ts` — “C2.1 — the scale”: *keeps the constants the contract names*, and “C2.1, C2.3 — the time bonus”. There is no second copy of the scale left to hold to it — `scale-parity.test.ts` went with the two it compared against, at step 10.9 |
| C2.2 | `packages/domain/src/hints.test.ts` — “C2.2 — the penalty is not cumulative”: *charges 200 for a reveal, not 250*. Also `packages/domain/src/scoring.test.ts` — “C2.2 — a hint level costs its total, not the sum”, and over HTTP `apps/web/app/api/game/hint/route.test.ts` — *charges the difference when the reveal follows the nudge* |
| C2.3 | `packages/domain/src/scoring.test.ts` — “C2.3 — a score can be negative” and “C2.1, C2.3 — the time bonus”. Through the route: `apps/web/app/api/game/submit/route.test.ts` — *lets a score go negative*, *gives no time bonus to a round that ran over* |
| C2.4 | `packages/domain/src/scoring.test.ts` — “C2.4 — the leaderboard”. In the reducer: `packages/domain/src/room/round.test.ts` — *C2.4 — orders the leaderboard by descending score*. On screen: `apps/web/src/round/leaderboard.test.tsx` |
| C2.5 | `packages/domain/src/scoring.test.ts` — “C2.5 — the reference case”: *scores 400* |

## C3 — Article generation

| Id | Test |
|---|---|
| C3.1 | `packages/article/src/generate.test.ts` — “C3.1 — positions designate exactly what changed” |
| C3.2 | `packages/article/src/paragraphs.test.ts` — “C3.2 — index parity”, on the frozen fixtures of `packages/article/fixtures` |
| C3.3 | `packages/domain/src/grading.test.ts` — “C3.3 — falseInfoNumber is sequential from 1 to n”, “C3.3 — positions are sorted by ascending index”, “C3.3 — indices are 1-based”. At the schema boundary: `packages/protocol/src/primitives.test.ts` — “paragraphIndex (C3.3)”. Rejected in the database: `packages/db/src/queries/game.test.ts` — *C3.3 — a 0-based paragraph index* |
| C3.4 | `packages/article/src/paragraphs.test.ts` — “C3.4 — what is collected, and what is not” |
| C3.5 | `packages/article/src/paragraphs.test.ts` — “C3.5 — whitespace normalisation” |
| C3.6 | `packages/article/src/generate.test.ts` — “C3.6 — the generator is stateless” |
| C3.7 | `packages/domain/src/room/round.test.ts` — “C3.7 — the article could not be produced”. Over the wire and uncached: `apps/realtime/src/article.test.ts` |

## C4 — Cache and accounting

| Id | Test |
|---|---|
| C4.1 | `packages/article/src/cache/keys.test.ts` — “C4.1 — the cache key”, and `packages/article/src/cache/cache.test.ts` — “C4.1 — normalised keys” |
| C4.2 | `packages/article/src/cache/cache.test.ts` — “C4.2 — copied in and out” |
| C4.3 | `packages/article/src/cache/cache.test.ts` — “C4.3 — TTL, variants, categories”, and `packages/article/src/cache/keys.test.ts` — “C4.3 — the bounds”. The phantom-category half of D14: `packages/article/src/cache/cache-failure.test.ts` — *leaves no phantom in the index when a category expires*, *counts what it holds, and not what has expired* |
| C4.4 | `packages/article/src/cache/cache.test.ts` — “C4.4 — variants served in rotation” |
| C4.5 | `packages/db/src/queries/usage.test.ts` — *C4.5 — a failed call does not enter perGeneratedGame*. Not cached either: `apps/web/app/api/game/start/route.test.ts` — *answers 502 when the model fails, and still bills the call* |
| C4.6 | `apps/web/app/api/usage/route.test.ts` — “C4.6 — what a generated game cost”, and `apps/web/src/game/usage.test.ts` — “C4.6 — the usage route”. In the REST catalogue: `packages/protocol/src/rest/contracts.test.ts` — “GET /api/usage (C4.6)” |

## C5 — Transport robustness

| Id | Test |
|---|---|
| C5.1 | `apps/realtime/src/server.test.ts` — “C5.1 — the nickname”: *refuses a nickname the contract does not allow, and says why first* — which is the “message before the close” half. The rule itself: `packages/protocol/src/primitives.test.ts` — “playerName (C5.1)” |
| C5.2 | `apps/realtime/src/server.test.ts` — “C5.2 — a connected homonym”: *is refused, and the player already in place is untouched*, *frees the nickname once the first socket closes*. In the reducer: `packages/domain/src/room/membership.test.ts` |
| C5.3 | `apps/realtime/src/server.test.ts` — “C5.3 — what a frame may be”: *answers bad_json and keeps the connection*, *ignores an unknown type in silence* |
| C5.4 | `packages/protocol/src/primitives.test.ts` — “chatContent (C5.4)” for the 400-character cap and the dropped empty message; the server enforces it by refusing the frame, `apps/realtime/src/server.test.ts` — *answers bad_json to a known message the schema refuses*. On screen: `apps/web/src/chat/chat.test.tsx` — “the 400-character bound” |
| C5.5 | `packages/protocol/src/primitives.test.ts` — “cursorCoordinate (C5.5)” for the clamp. Server-side rate limit: `apps/realtime/src/throttle.test.ts` — “5.6 — the throttle”, and `apps/realtime/src/hardening.test.ts` — *does not relay a cursor flood beyond the throttle*, *does not rebroadcast a live_score flood beyond the throttle* (D6) |
| C5.6 | `apps/web/app/api/multiplayer/create/route.test.ts` — “C5.6 — a code nobody else holds” and “C5.6 — the cap”. The shape: `packages/protocol/src/primitives.test.ts` — “roomCode (C5.6)” |
| C5.7 | `apps/realtime/src/server.test.ts` — “C5.7 — a frame beyond 64,000 characters”: *closes with 1009, without answering*, *lets a frame just under the limit through* |

## C6 — CC BY-SA compliance and indexing

| Id | Test |
|---|---|
| C6.1 | `apps/web/src/round/after-round.test.tsx` and `apps/web/src/round/round.test.tsx` for during and after; end to end on every client in `apps/e2e/specs/multiplayer.spec.ts`, `room.spec.ts` and `solo.spec.ts` |
| C6.2 | `apps/web/src/indexing.test.ts` — “C6.2 — robots.txt” (the `/api` and `/ws` disallows, the four training crawlers refused everything, the declared sitemap) and “C6.2 — sitemap.xml”. On the real responses of a production build: `apps/e2e/specs/indexing.spec.ts` — *C6.2 — robots.txt keeps the crawlers out where it must*, *C6.2 — sitemap.xml declares the front door*, *C6.2 — the game screens are not offered to a crawler* |
| C6.3 | `<html lang="fr">`: `apps/web/src/language.test.ts` — *leaves the document's own lang to step 11.5*. Bounded title and description: `apps/web/src/indexing.test.ts` — “C6.3 — what a search result and a shared link show”. Open Graph and the canonical: `apps/web/app/layout.test.ts` — “C6.3 — the metadata every page starts from”, and in the served head, `apps/e2e/specs/indexing.spec.ts` — *C6.3 — the head carries the canonical and the share tags* |

## C7 — Deployment identity

| Id | Test |
|---|---|
| C7.1 | `apps/web/app/ping/route.test.ts` — “C7.1 — GET /ping”, `apps/realtime/src/server.test.ts` — “C7.1 — the probe the platform reads”, and the shared shape in `packages/protocol/src/rest/contracts.test.ts` — “GET /ping (C7.1)” |
| C7.2 | `apps/web/app/api/health/route.test.ts` — “C7.2 — GET /api/health”, `apps/web/src/deployment.test.ts` and `apps/realtime/src/deployment.test.ts` — “C7.2 — the deployment identity”, including the key never appearing in the serialised JSON |
| C7.3 | `apps/e2e/specs/indexing.spec.ts` — *C7.3 — GET / answers HTML 200 with a non-empty title*, which checks the status, the content type, the title and that the URL is still `/`. Guarded without a browser too: `apps/web/app/layout.test.ts` — “C7.3 — the front door is a page, not a redirect”, where a reinstated `redirect()` throws |

## C8 — The documentation ↔ code lock

| Id | Test |
|---|---|
| C8.1 | `apps/web/src/route-parity.test.ts` — “C8.1 — the REST catalogue equals the routes that exist”, and `apps/realtime/src/catalogue-parity.test.ts` — “C8.1 — the outbound catalogue equals what the server emits”. The inbound half needs no test: `frames.ts` decodes with `incomingMessage`, so the schema **is** the dispatch table, and the reducer switches over the union with no `default`, so an unhandled type is a compile error. Both replaced the Python-reading pair at step 10.9 |
| C8.2 | `packages/protocol/src/docs/docs.test.ts` — *matches what is committed at %s*, over the four generated pages, plus the 200-line and trailing-newline checks a generated page has to pass too |

## What the grid found

Six of the eight sections were already covered by tests that name the
guarantee they hold — the labels were written with the code, not reconstructed
here. The exceptions were C6.2, C6.3 and C7.3: the compliance surface of the
old `frontend/public/` was never given to a phase, so no phase failed to
deliver it. That was a hole in the plan rather than in a branch, which is why
step 10.0 filled it here instead of sending it back.

C7.3 was the one that was not merely untested: `/` redirected to `/play`, so
the front door answered 307 and no document. A missing test had been hiding a
broken clause, which is the argument for this grid in one line.

With 10.0 delivered, every line of the contract points at a named test, and
those tests run: 1,884 unit and integration cases across the ten packages,
plus eleven browser journeys. Nothing is skipped when Postgres and Redis are
present, which is how CI runs them.

Step 10.9 then deleted the old stack, and with it the six tests that compared
the new one to it. Five were redundant the moment their subject went — the
scale, the item identifiers and the token transcription are each asserted
against the contract directly. **C8.1 was not**, and it was rebuilt rather
than dropped: the two cells above name its replacements, which hold the same
line against the routes and the messages of `apps/`. That is what C8.2 means
by "otherwise the guarantee disappears without a sound".
