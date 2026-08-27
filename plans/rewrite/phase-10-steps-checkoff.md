# Phase 10 — the check-off steps

> Definitions of steps 10.0 to 10.8. The step states live in
> `phase-10-cutover.md`; the grid these steps produce lives in
> `phase-10-contract-map.md`.

For 10.1 to 10.8, the completion rule is shared: **every bullet of the
section points to a named test (file and case) in the new stack, the
mapping is recorded in `phase-10-contract-map.md`, and those tests pass in
CI**. A hole discovered there is not filled there: we go back to the phase
concerned, on its branch.

### 10.0 — Port the compliance surface no phase owned

The check-off found one hole, and it is not a phase's to answer for: C6.2
(`robots.txt`, the training-crawler exclusions, the declared sitemap), the
Open Graph and canonical half of C6.3, and C7.3 (`GET /` as HTML 200 with a
non-empty `<title>`) were never given to a step. The old stack holds them in
`frontend/public/robots.txt`, `frontend/public/sitemap.xml` and
`frontend/src/__tests__/indexing.test.js`; `apps/web` has no equivalent, and
`apps/web/app/page.tsx` redirects the front door instead of serving it.

Delivered here rather than sent back, because there is no branch to send it
to — and because indexing only starts to matter when 10.11 points the domain
at Vercel. Ported through Next's own metadata files (`robots.ts`,
`sitemap.ts`, `metadata`), not as static copies under `public/`: the sitemap
has to name the routes that exist, and a copied file would be a second place
to keep them.

**Done when**: `robots.txt` disallows `/api` and `/ws` and excludes GPTBot,
ClaudeBot, Google-Extended and CCBot, declares the sitemap, and the sitemap
answers with the public routes; the metadata carries a bounded title and
description, Open Graph and a canonical; `GET /` answers HTML 200 with a
non-empty `<title>`; and each of those has a test, so C6.2, C6.3 and C7.3
have a cell in the grid like every other line.

### 10.1 — Check off "Server authority"

Start payload without the solution — verified by keys **and by values** —,
server-side score and client penalties ignored, monotonic hints billed
once, `HINT_LOCK`, score theft and SCANNER applied server-side, host role
verified server-side, promotion and room end.

**Done when**: the shared rule is met for the section.

### 10.2 — Check off "The scoring scale"

The formula, the constants, the non-cumulative hint cost, the possible
negative score, no bonus past the deadline, and the reference case
`tp=3, fp=1, penalty=20, stolen=50, 200 s left out of 300 → 400`.

**Done when**: the shared rule is met for the section.

### 10.3 — Check off "Article generation"

`positions` designates the actually modified paragraphs, strict index
parity, base-1 indexes, deduplication, whitespace normalisation, stateless
generator, clean failure when the Wikipedia page is not found.

**Done when**: the shared rule is met, backed by real HTML fixtures.

### 10.4 — Check off "Cache and accounting"

Normalised keys, copies on the way in and on the way out, 6 h TTL, 3
variants, LRU 200, variant rotation, failure neither cached nor counted,
`cache_hit_rate` and `per_generated_game` exposed.

**Done when**: the shared rule is met for the section.

### 10.5 — Check off "Transport robustness"

Nickname validated and rejections typed, homonym refused, `bad_json`
without closing the connection, bounded chat, bounded and rate-limited
cursors, unique room codes and 503 ceiling, frames beyond 64,000
characters → close 1009.

**Done when**: the shared rule is met, protocol and e2e tests together.

### 10.6 — Check off "Compliance and indexing"

CC BY-SA attribution during and after the round, `robots.txt` excluding
training crawlers, `<html lang="fr">`, bounded meta tags, Open Graph,
canonical, sitemap.

**Done when**: the shared rule is met for the section.

### 10.7 — Check off "Deployment identity"

Exact `/ping`, `/api/health` field by field, API key never exposed, `GET /`
as HTML 200 with a non-empty `<title>`.

**Done when**: the shared rule is met — phase 9 already had to meet it,
this step records the fact, without rewriting anything.

### 10.8 — Check off "The documentation ↔ code lock"

The generated-versus-committed test from phase 9 runs in CI and covers what
`test_architecture_doc.py` covered: inbound messages, outbound messages,
routes.

**Done when**: deliberately breaking the generated doc makes CI fail.

