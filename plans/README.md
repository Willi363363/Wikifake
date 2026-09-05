# plans/

All project documentation lives here. Nothing at the repository root except
`README.md` and `CLAUDE.md`, and **no file over 200 lines** — a hook checks it.

## Where to start

| You want to… | Read |
|---|---|
| know how we work | `method/00-dev-cycle.md` |
| create a branch, open a PR | `method/01-git-flow.md` |
| know what is forbidden | `method/02-repository-rules.md` |
| understand the environments and the locks | `method/03-infrastructure.md` |
| run the project locally | `current-state/07-local-setup.md` |
| understand the current code | `current-state/` |
| know what is being built now | `product/00-overview.md` |
| know where the rewrite went | `rewrite/00-overview.md` |
| **know what must never break** | `rewrite/01-contract-to-preserve.md` |
| read the protocol, message by message | `protocol/README.md` |
| work right now | the file for the current phase, below |

## Where the project stands

**The rewrite is finished and in production.** The effort under way now is the
product one: art direction, gamification, and what a launch needs. Its tracks
are defined in `product/`, and their state is the table below.

| # | Track | State | File |
|---|---|---|---|
| A | Art direction | ⬜ not started | `product/01-art-direction.md` |
| B | Design system on the new direction | ⬜ not started | `product/02-design-system.md` |
| C | Landing — the scroll scene | ⬜ not started | `product/03-landing.md` |
| D | Game surface | ⬜ not started | `product/04-game-surface.md` |
| E | Accounts and player statistics | ⬜ not started | `product/05-accounts.md` |
| F | Quests | ⬜ not started | `product/06-quests.md` |
| G | Leaderboards | ⬜ not started | `product/07-leaderboards.md` |
| H | Coins and the shop | ⬜ not started | `product/08-economy.md` |
| I | Admin panel | ⬜ not started | `product/09-admin.md` |
| J | SEO, legal and polish | ⬜ not started | `product/10-seo-and-legal.md` |

What was deliberately left out of it, with the reasons, is in
`product/11-deferred.md`.

## Where the rewrite ended

The rewrite replaced the whole stack: Python and FastAPI disappear in favour
of a TypeScript monorepo. Twelve phases, in this order — each depends on the
previous one unless its file says otherwise.

| # | Phase | State | Fiche |
|---|---|---|---|
| 0 | Foundations — monorepo and tooling | ✅ **done** | `rewrite/phase-00-foundations.md` |
| 1 | Core — `protocol` and `domain` | ✅ **done** | `rewrite/phase-01-core.md` |
| 2 | Data — Drizzle and Postgres | ✅ **done** | `rewrite/phase-02-data.md` |
| 3 | Article — Wikipedia and model | ✅ **done** | `rewrite/phase-03-article.md` |
| 4 | API and authentication | ✅ **done** | `rewrite/phase-04-api-and-auth.md` |
| 5 | Realtime — WebSocket and Redis | ✅ **done** | `rewrite/phase-05-realtime.md` |
| 6 | Design system | ✅ **done** — both palettes pass every contrast pair | `rewrite/phase-06-design-system.md` |
| 7 | Frontend — lobby and waiting room | ✅ **done** | `rewrite/phase-07-frontend-lobby.md` |
| 8 | Frontend — the round | ✅ **done** | `rewrite/phase-08-frontend-round.md` |
| 9 | Observability and CI/CD | ✅ **done** — both services probed, and the probe proved by hand | `rewrite/phase-09-observability-and-cicd.md` |
| 10 | Cutover — removing the Python | ⚠️ **production runs the new stack**, multiplayer included — 10.10's dry run and the domain are what is left | `rewrite/phase-10-cutover.md` |
| 11 | Internationalisation | ⚠️ **live in English and French**, error pages included — the French catalogue awaits a human review, and the protocol's sentences await a decision | `rewrite/phase-11-i18n.md` |

**This table is the only place that says where we stand.** It is updated when
a phase changes state. Steps are ticked off in the phase file.

Phase 10 has a non-negotiable entry condition: every guarantee of
`rewrite/01-contract-to-preserve.md` and
`rewrite/02-contract-transport-and-compliance.md` must have an equivalent
test in the new stack. As long as one is missing, the Python stays.

## Structure

```
plans/
├── method/          how we work — read once, respect always
├── protocol/        generated from the Zod schemas — never edited by hand
├── current-state/   what exists today, how to run it, and the known debt
├── rewrite/         how the stack got here: overview, contract, one file per
│                    phase. Finished. A big phase splits: the phase file keeps
│                    the frame and the step tables, satellite sheets carry the
│                    definitions and the decisions. See phase 1.
└── product/         what is being built now: one file per track, each one
                     startable without reading the other ten.
```

## Rules of this documentation

- 200 lines maximum per file. Beyond that, split.
- Documentation is updated **in the PR that changes the behaviour**, not
  afterwards.
- No parallel tracking file. No `TODO.md`, no `NOTES.md`: they diverge in a
  week and lie in two.
- `protocol/` is **generated**. Edit the schemas in `packages/protocol`, then
  `pnpm --filter @wikifake/protocol docs`. A test fails on divergence, so a hand
  edit is caught rather than believed.
- A problem found out of scope is recorded in
  `current-state/05-known-debt.md` and is not fixed on the spot.
