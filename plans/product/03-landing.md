# Track C — the landing, and its scroll scene

| | |
|---|---|
| **State** | ⬜ not started |
| **Branch** | `feat/landing-scene` |
| **Depends on** | tracks A and B |
| **Delivers** | the marketing route: what the game is, and a way in |

## Objective

A landing page built as a **fixed stage**: the viewport is a camera that never
moves, and the elements travel across it as the page scrolls, overlapping and
reacting to each other. The reference is the awwwards register — a site that
is itself a demonstration.

## The boundary, restated

This treatment lives on the landing **and nowhere else**. The lobby, the round
and the debrief are track D, and they are calm by comparison. A timed
multiplayer round with a scroll-driven camera is a round nobody can play.

## Four non-negotiables

These are what separate this from the version of this idea that gets built,
demoed once and quietly deleted.

1. **Native scroll. No scroll-jacking.** The page scrolls at the speed the
   browser says. Elements are positioned *from* the scroll offset; the scroll
   is never intercepted, slowed, snapped or animated. Hijacking it breaks the
   scrollbar, the keyboard, the trackpad's momentum and every assistive
   technology at once — and it is the single most common reason a site in this
   register is unusable rather than impressive.
2. **A real page underneath.** With `prefers-reduced-motion`, the scene
   resolves to a static, correctly ordered document — headings, text, a call
   to action. Not a frozen animation. Not a blank stage. Someone who never
   sees a single element move must still learn what the game is and be able to
   start one.
3. **A performance budget, decided before the first animation.** Composite-only
   properties (`transform`, `opacity`); no layout-triggering property animated
   per frame; the scene detached when off-screen. The budget: **60fps on a
   mid-range Android**, and no regression to the existing Lighthouse scores.
   Measured on a device, not on a laptop.
4. **The content is HTML.** Headings are headings, the call to action is a
   link, the copy is in the i18n catalogue. The scene is a presentation layer
   over a document that works with CSS disabled.

## The narrative

The scroll tells the game in four beats. Copy is track J's to sharpen; the
sequence is what this track builds:

| Beat | What crosses the stage |
|---|---|
| 1 | The title, and the question — *who is lying?* |
| 2 | A real Wikipedia paragraph drifts in, calm and readable |
| 3 | A second one slides over it, subtly wrong — the two collide and the false one is marked |
| 4 | The scoreboard assembles, and the way in resolves under it |

Beat 3 is the product demonstration. If a visitor understands the game from
beat 3 alone, the page has done its job and the rest is atmosphere.

## Steps

| # | Step | State |
|---|---|---|
| C.1 | The static document — content, headings, CTA, in the catalogue | ⬜ |
| C.2 | The stage: fixed viewport, scroll-offset driver | ⬜ |
| C.3 | Beats 1 and 2 | ⬜ |
| C.4 | Beat 3 — the collision, and the mark | ⬜ |
| C.5 | Beat 4 — the scoreboard and the way in | ⬜ |
| C.6 | Reduced-motion path, checked as a document | ⬜ |
| C.7 | Performance pass on a real mid-range device | ⬜ |
| C.8 | Social share image, and the meta tags | ⬜ |

**C.1 comes first on purpose.** Building the document before the scene means
the reduced-motion path is the thing that already exists rather than the thing
retrofitted, and it is the only ordering under which non-negotiable 2 is
cheap.

## Exit gate

- Keyboard alone: reach the call to action and start a game, top to bottom.
- `prefers-reduced-motion: reduce`: a readable static page, CTA included.
- CSS disabled: the copy still reads in a sensible order.
- 60fps sustained through the four beats on a mid-range Android.
- Lighthouse: no category below its current score on the existing home route.
