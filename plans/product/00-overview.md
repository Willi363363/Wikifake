# The product effort — overview

The rewrite is finished and in production. It bought a stack that can be built
on; it did not buy a game anybody plays twice. **This effort is about the
second thing.**

The goal, in one sentence: *a game people come back to, built so that it could
be handed to somebody else — or sold — without an apology.*

## The two rules of this effort

1. **Nothing is monetised before the rest is clean.** No advertising, no real
   payment, no revenue instrumentation until the tracks below are done. The
   reasoning, and what is deferred, is in `11-deferred.md`.
2. **A track is startable on its own.** Each file below states its
   dependencies, its steps and its exit condition, so one agent can take one
   track without reading the other ten. That is the whole point of splitting
   them this way.

## The tracks

| # | Track | State | Depends on | File |
|---|---|---|---|---|
| A | Art direction — the DA itself | ⬜ not started | — | `01-art-direction.md` |
| B | Design system — the DA in code | ⬜ not started | A | `02-design-system.md` |
| C | Landing — the scroll scene | ⬜ not started | A, B | `03-landing.md` |
| D | Game surface — the DA on the screens | ⬜ not started | B | `04-game-surface.md` |
| E | Accounts and player stats | ⬜ not started | — | `05-accounts.md` |
| F | Quests | ⬜ not started | E | `06-quests.md` |
| G | Leaderboards | ⬜ not started | E | `07-leaderboards.md` |
| H | Economy — coins and shop | ⬜ not started | E, F | `08-economy.md` |
| I | Admin panel | ⬜ not started | E | `09-admin.md` |
| J | SEO, legal and polish | ⬜ not started | A | `10-seo-and-legal.md` |

`plans/README.md` carries the state of this table. It is not duplicated here —
this file describes the tracks, that one says where they stand.

## Why A comes first, and what it blocks

Every track that draws anything — C, D, and half of I and J — writes markup
that inherits the design system. Doing them before the art direction is
settled means writing that markup twice, and the second pass is the one nobody
budgets for.

So: **A defines the direction, B lands it in `packages/ui`, and only then do C
and D draw.** E through I are the exception — they are data, rules and
queries, and they can run in parallel with A and B as long as their screens
are drawn last.

```
A ──► B ──┬──► C  (landing)
          └──► D  (game surface)

E ──┬──► F ──► H
    ├──► G
    └──► I
```

## What already exists, and must not be rebuilt

The single most common way to waste this effort is to rebuild something the
rewrite already shipped. Checked against the code, not remembered:

- **Authentication is done.** `better-auth`, with Google *and* GitHub already
  wired in `apps/web/src/auth/providers.ts`, enabled by the presence of their
  credentials. Track E needs OAuth keys and a profile screen, not a login
  system.
- **The database is done.** Drizzle on Postgres, with `user`, `profile`,
  `room`, and the `audit` and `usage` tables. Tracks F, G, H and I add tables;
  they do not choose a database. Supabase was considered and refused —
  `11-deferred.md` records why.
- **The design system exists.** `packages/ui` has tokens as data, a themed
  stylesheet, keyboard-reachable primitives, a motion layer that honours
  `prefers-reduced-motion`, and a contrast audit over 20 pairs that both
  palettes pass. Track A changes the *values* and the *grammar*; the
  architecture stays.
- **The cost of a game is already a query.** `llm_call` records every model
  call, working or not. Track I reads it; it does not build it.
- **The i18n catalogue is done**, English and French, with localised routes,
  per-locale SEO metadata and error pages. Every string this effort adds goes
  in the catalogue — no exceptions, or the French half rots.

## What "done" means for this effort

Not a checklist of features. Three conditions:

- A first-time visitor understands the game before they scroll, and can play
  it without an account.
- A returning player has a reason to return that does not require anybody to
  write content each week.
- Somebody who has never seen the repository can read `README.md`, follow one
  link, and run the thing locally.

The third is the one that gets skipped, so it has its own track: J.
