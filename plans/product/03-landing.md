# Track C — the landing, and its scroll scene

| | |
|---|---|
| **State** | 🔶 in progress — C.1 and C.2 done: the document, and the camera over it |
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
| C.1 | The static document — content, headings, CTA, in the catalogue | ✅ |
| C.2 | The stage: fixed viewport, scroll-offset driver | ✅ |
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

**C.1 is done**, and the front door is `apps/web/src/landing/` — one `h1` and a
`h2` per beat, the way in twice as a link, every sentence a `home` catalogue
entry in both locales. `landing.test.tsx` reads the markup and never a style, so
it keeps holding when C.2 lays a camera over it.

Three decisions it made, each of which C.2 to C.5 inherit:

- **The demonstration quotes a real article, frozen at a revision.** Beat 3 only
  demonstrates anything if its true half is true, so `excerpt.ts` carries an
  extract of *Tour Eiffel* with the `oldid` it was taken from, and one number
  rewritten. Quoting Wikipedia at all brings CC BY-SA with it: the page renders
  the round's own `<Attribution>` rather than a second wording of a licence
  notice, and the softer sentence the front door used to carry is gone.
- **The extract is French in both locales.** The game reads `fr.wikipedia.org`,
  so an English landing showing an English extract would advertise a game that
  does not exist. What carries the demonstration for a reader of no French is
  the tell — `beats.collision.tell` names both values through placeholders.
- **`language.test.ts` grew a named exemption.** The scan refuses French words
  in `apps/web` sources, and until now every article reaching a screen came from
  a fixture or a request. `src/landing/excerpt.ts` is the first French *literal*
  in a source file. It is exempted by path, exactly one entry, with a test
  holding the list to being precisely the files that would fail without it —
  an exemption nobody removes is how a scan shrinks to nothing.

The scoreboard of beat 4 reads `@wikifake/domain`'s constants, formatted with
`Intl.NumberFormat` for the interface locale — `+0.5` and `+0,5`. C2 has one
source of truth and a landing page advertising 150 while the server paid 120 is
exactly the lie that rule exists to prevent.

**C.2 is done: the camera is `position: sticky`.** Non-negotiable 1 is bought by
using a browser feature rather than resisting one — nothing listens for a wheel
event, the scrollbar is the real one and the right length, and `End` still goes
to the end. The driver publishes `--stage-progress` on the track and
`--beat-progress` on each beat; the stylesheet spends them on `transform` and
`opacity` and on nothing else.

**Three switches decide whether any of it engages, and two of them are CSS.**
`prefers-reduced-motion: no-preference` and `md` and up live in the media query,
so they hold before hydration; below either one, what is left is C.1's document
in reading order rather than a frozen frame. A fixed camera on a 640px-tall
phone is a viewport that clips the article it is trying to show, which is why
the second switch exists. The third is JavaScript, which a stylesheet cannot
ask about: a `<noscript>` block reverts the three rules, and it is the one
`!important` in this repository that earns itself.

**The driver never re-decides any of that.** It asks `getComputedStyle` whether
the camera actually came out `sticky`. A breakpoint written once in CSS and
again in JavaScript is a pair that disagrees the first time either moves.

The performance budget of non-negotiable 3, decided here rather than measured
afterwards: one read per frame and it is `scrollY`; geometry cached and
re-measured only on `ResizeObserver`; writes are custom properties spent on
composite-only properties; rAF-batched; and the whole thing detached by an
`IntersectionObserver` once the stage leaves the viewport. C.7 measures it on a
device — this is what it will be measuring.

**A transparent link is still a link.** Four stacked beats means three invisible
calls to action in the tab order, so the driver marks every beat outside
`BEAT_FADE_EDGE` `inert`. `stage.test.tsx` holds that number and the
stylesheet's own fade together, because a media query cannot import a constant.

## Exit gate

- Keyboard alone: reach the call to action and start a game, top to bottom.
- `prefers-reduced-motion: reduce`: a readable static page, CTA included.
- CSS disabled: the copy still reads in a sensible order.
- 60fps sustained through the four beats on a mid-range Android.
- Lighthouse: no category below its current score on the existing home route.
