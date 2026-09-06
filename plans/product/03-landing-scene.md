# Track C — how the scene was built

The record of steps C.1 onwards: what each one decided, and what it got wrong
before it was right. `03-landing.md` keeps the frame — the objective, the four
non-negotiables, the narrative and the step table, which is the only place that
says where a step stands.

Kept because the scene is a mechanism nobody rereads. Every paragraph below is a
thing that was measured or looked at rather than reasoned about, and each one
cost an iteration to find.

## C.1 — the document

The front door is `apps/web/src/landing/` — one `h1` and a
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

## C.2 — the stage

**The camera is `position: sticky`.** Non-negotiable 1 is bought by
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

## C.3 — beats 1 and 2

**Depth is a vocabulary rather than four rules.**
`--depth` is how many rems further — or less — an element travels than the beat
carrying it, and `--arrive-from` is how far to one side it waits before its turn.
Both live in one `.landing-move` rule, because an element has one `transform` and
two classes each declaring one is a bug that reads like a cascade problem. C.4
and C.5 extend this; they do not start again.

The difference in travel is the **only** depth cue this direction allows itself:
no blur, no scale, no shadow that grows. Beat 1 arrives in three layers — the
question ahead, the brand line behind, everything else with the beat. Beat 2's
paragraph drifts in from the right and settles exactly on its turn, then leaves
straight up: something that arrived from one side and left the same way reads as
a carousel.

Two things a browser found that no render test could:

- **The scene is rendered at rest, not waited for.** Until the driver's first
  frame every beat fell back to `--beat-progress: 0` — four beats stacked at
  full opacity, on every load, as the first thing a visitor sees. `Stage` now
  server-renders each beat's value. It deliberately does **not** render `inert`
  with it: a browser running no script never reaches the driver, and beats it
  could not focus would be a page with three quarters of itself missing.
- **A test scrolled to the wrong place and blamed the CSS.** The document has
  padding above the stage, so "a third of the way down the page" and "beat 2's
  turn" are ten pixels apart. `landing.spec.ts` computes its scroll positions
  from the track's own box now, in the scene's own units.

`movement.test.ts` is the other half: every `landing-` class the markup writes
has a rule, and nothing that moves is declared outside the media query. A
mistyped class is a silent no-op, and a rule outside the query is non-negotiable
2 undone by a brace — neither fails a render.

## C.4 — the collision

**Beat 3 is a collision because it lands in the same place.** Beats 2
and 3 are the same paragraph twice, so `ArticleBeat` renders both: three fixed
rows — what is said above the article, the article, what is said below it — and
beat 2 reserves the third row it has nothing to put in. Two hand-written
sections would drift apart the first time somebody added a line to one, and the
failure would be invisible until somebody scrolled to the handover and looked.

Three decisions make the collision read, and each was wrong first:

- **The article does not drift.** A beat travels three rems against the scroll,
  so two beats mid-handover are six rems apart — and two sheets six rems apart
  *pass each other*. `--depth: -3` on the sheet cancels exactly that, which is
  also the right thing to say about the scene: the article is the fixed point,
  the commentary is what moves.
- **The words cut and the article does not.** A beat wrapper is now solid out to
  ±0.6 and gone by ±0.85; the copy inside is on a ramp that reaches zero at
  ±0.5, which is the handover exactly. So at the moment two beats change places
  the only thing on the stage is the paragraph, and the false one lands on the
  true one instead of mixing with it. `BEAT_FADE_EDGE` moved from 0.6 to 0.85
  with it.
- **The credit line is copy, not article.** It sits inside the figure, so it
  rode the sheet's wide plateau and both captions were legible on top of each
  other through the whole handover.

**The mark is wiped in, not faded**: a pseudo-element scaled on one axis, which
is composite-only and is what a highlighter does. It needs `isolation: isolate`
— without a stacking context of its own the `z-index: -1` resolved against the
page and painted the wash *behind the reading sheet's ground*, so the mark
simply never appeared. Found by looking at it, not by a test.

The scene's CSS is two files now — `landing-stage.css` is the mechanism,
`landing-article.css` is the one scene that uses it — and the browser journeys
split the same way. `movement.test.ts` holds every `landing-*.css` to the
identical media query, because CSS cannot hand one condition to two files.

## A trap in running the journeys, found the hard way

`playwright.config.ts` sets `reuseExistingServer` whenever `CI` is unset, so a
web server already listening on 3100 is **used as-is** — the config's build and
its whole environment block are skipped, silently.

Probing the scene by hand means starting that server by hand, and a
hand-started one is missing whatever the config would have set. Here it was
`NEXT_PUBLIC_REALTIME_URL`: the two multiplayer journeys failed on
*"Players (2) not found"*, which reads as a socket regression and is a page that
was never told where the socket is. Both passed the moment the stray server was
stopped.

**Stop any hand-started server before `pnpm e2e`.** A green run against the
wrong server is the more expensive half of this — it is the direction the same
mistake fails in when the missing variable happens not to matter.

This belongs in `plans/current-state/06-structural-debt.md` with the other
"found by causing it" entries. It is here because that file is at 190 lines and
the last handover was explicit that the next finding needs the split, not a
squeeze — and splitting a debt register is not this step.
