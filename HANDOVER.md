# Session handover — 2026-09-06

> Written in English, like everything else in this repository (`CLAUDE.md`).
>
> Replaces the handover of 2026-08-30, which described the rewrite's last loose
> ends. Those are still open and are restated below; everything else in it is
> now history.

## Context

The rewrite was finished; the game was not. This session planned the product
effort, and delivered the first two tracks of it: an art direction and the
design system that carries it. It also fixed `pnpm dev`, which had never worked.

## State at the pause

- Working tree clean. `main` and `staging` are the only remote branches.
- **`plans/product/`** is new: ten tracks, one file each, plus what was
  deliberately deferred and why. `plans/README.md` carries their state.
- **Tracks A, B and D are done.** C and E to J are not started.
- Thirteen pull requests, #158 to #170.

## What went out

**The art direction.** Playful neo-brutalism, chosen by the owner from four
proposals: flat saturated fills, 3px structural borders, hard offset shadows,
square corners, Archivo throughout, JetBrains Mono where a room code is typed.

**Its one important decision is the reading-surface exemption.** The grammar
applies to the chassis and never to the article being judged. A paragraph in a
3px box with a yellow fill is a paragraph nobody reads carefully, and reading
carefully is the game. `ReadingSheet` enforces it by construction: it accepts no
prop for a border, a fill, a shadow or a tone, and a test holds it to that by
prefix. The text is calm; the act of marking it is loud.

**The palette was measured before it was written** — forty pairs, both palettes,
tightest margin ×1.54, recorded in `plans/product/01-palette.md`. Phase 6 had
shipped a palette that looked right and failed seven pairs; measuring first cost
an hour, and repairing after had cost a session.

## The finding this session turned on

Making the accents *fills* silently broke every place still using them as
*text*. Measured with the audit's own functions, in the light palette:

```
danger on bg           2.95   every error message
warn   on surface      1.83   the clock, at its most urgent
bronze on surface      2.01   what a hint costs
accent on accent-soft  1.20   a paragraph the player designated
```

Each had been **correct** while the accents were dark. All of them pass in the
dark palette, which is why nobody saw it: the failure was invisible to anybody
working in dark mode.

Thirty-two came out of a pattern sweep. Four more only a browser found,
including a rival player's name written in white on a colour the *server*
chooses — eight hues, half light and half dark, so **no** text colour passes on
it. That pair was not unmeasured, it was unmeasurable; the colour is a swatch
beside the name now.

**Why the audit could not see any of it:** `CONTRAST_PAIRS` measures the pairs
the *design system* declares. These were pairs the *screens* invented, in
`apps/web`, out of its reach. `apps/web/src/fills.test.ts` is that gap closed.

## What the tests learned

Every finding left a scan behind rather than a fix alone:

- `fills.test.ts` — no fill as a text colour, no `text-white`/`text-black`, no
  colour-on-colour edge, no hover lift, no hover shadow. With a test for its own
  comment-stripping, because a scan of nothing passes everything.
- `global-error.palette.test.ts` — the crash page's hardcoded hexes held to the
  theme. It wore phase 6's palette through the entire change, because no scanner
  in this repository sees a hex inside a `style={{ }}` object.

**Two assertions were rewritten rather than deleted** when the direction
invalidated them, and both got stronger. `theme.test.ts` said every colour must
differ between the palettes; the fills break that deliberately, so it now names
which repeat and holds them *identical* — catching a fill that drifted, which
the original could not. `contrast.test.ts` pinned seven ratios; it pins forty.

## `pnpm dev` works now

It had never loaded an environment: nothing read the root `.env`, and Turbo's
strict mode stripped what survived. `.env.local` is read first, `.env` still
accepted, and a variable already exported always wins — which is what keeps CI
and production untouched. `#168`.

## Read this before trusting a green

- **The suites skip ~250 cases without Postgres and Redis, and still report
  success.** Read the `skipped` count; a real run says `0 skipped`.
- **Turborepo replays greens it never ran.** `pnpm exec turbo run <task> --force`.
- **`border-l-3` emits no CSS rule at all**, while `border-3`, `border-r-3`,
  `border-t-3` and `border-b-3` all resolve. Measured on all four sides.
  `06-structural-debt.md` carries it. Read the built stylesheet rather than
  trusting a class name.
- **Applying `revu` right after opening a pull request cancels the in-flight
  conformance run**, and the `labeled` run that replaces it skips those jobs —
  so they read `skipping` and the pull request looks green. It bit twice this
  session. Wait for the checks, *then* label.

## Outstanding

Inherited from the last handover, still open:

- **Step 10.10's dry run** — Resume the suspended Render service, read
  `/api/health`, write the commit into `phase-10-rollback.md`, Suspend.
- **Move the domain**, runbook step 5. The public domain still points at Render.
- **A rollback must recreate `DEPLOY_URL`.**
- **The Google AI key from the 2026-08-27 transcript**, if never regenerated.

New:

- **The `rules.yml` concurrency bug** above. Fixing it means editing
  `.github/workflows/`, and the `gh` token has no `workflow` scope.
- **Chat rail covers a card border at 360px** — placement, its own step.
- **`disabled:opacity-40`** is the one translucency the direction forbids, and
  it belongs to `packages/ui`.
- **Both debt registers are near the 200-line cap** (198 and 190). The next
  finding needs a split, not a squeeze.

## Next steps, in order

1. **Track C — the landing.** It is the only track B unblocked that is not done,
   and `03-landing.md`'s four non-negotiables are the whole of it: native
   scroll, a real page underneath, a performance budget decided first, and
   content that is HTML.
2. **Track E — accounts.** Google sign-in is already wired and waiting on two
   environment variables; the work is the profile and the statistics.
3. The tracks after that are E's dependents: F, G, H, I.

## Commands to resume

```bash
export PATH="$HOME/.nvm/versions/node/v22.23.2/bin:$PATH"   # nvm use is a no-op here
pnpm install && pnpm hooks

docker start wf-pg wf-redis
cp .env.example .env.local        # then fill it in
pnpm migrate

pnpm dev                          # both services, no flags
pnpm test && pnpm typecheck       # read the skipped count
pnpm e2e                          # 24 browser journeys
```

Read first, in this order:

```
plans/README.md                     # where the project stands
plans/product/00-overview.md        # the effort under way, and its rules
plans/product/01-art-direction.md   # the direction, and what it costs
plans/current-state/06-structural-debt.md
```

---
*Written by Claude Code, from a session that measured before it wrote.*
