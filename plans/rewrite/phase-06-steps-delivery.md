# Phase 6 — steps: how it is shown, and checked

> Steps 6.5 and 6.6 — the gallery, the viewports it has to survive, and the
> audit that decides whether any of it is legible. The phase sheet, its exit
> gate and where each step stands: `phase-06-design-system.md`.

### 6.5 — Responsive

The package's components are built fluid, breakpoints defined in the theme.
There is a single media query in the whole project today.

**The single media query is real, and it is smaller than it sounds.** It is in
`settings.css` and it shrinks one popover; every other screen of the game is
laid out for a desktop and cropped on a phone. Several panels are fixed at 580,
560 and 440 pixels, which do not look cramped at 360 — they produce a page that
scrolls sideways.

Three decisions taken while writing it:

- **The breakpoints are Tailwind's own values, declared.** This is not a place
  to invent a scale. What naming them buys is that a reviewer sees the four
  sizes without reading a framework's defaults, and moving one becomes a
  decision with a diff.
- **`--width-floor: 360px` is a token, and it is the number the rules are
  written against.** A phone held upright, and the width the criterion names.
- **The rules are checked in the source, because there is no browser.**
  `responsive.test.ts` enforces two, per file, across the package *and* the
  gallery: no fixed length above the floor without a breakpoint in front of it,
  and no unconditional multi-column layout. Neither is a proxy for a screenshot
  — both are the actual defect that produces sideways scrolling, and a
  regression in either is caught here rather than on somebody's phone. Both were
  checked against a deliberate violation.

The paragraph token grew `break-words hyphens-auto`: Wikipedia prose carries
chemical names, German compounds and bare URLs, and without it a single word
decides the width of the page.

`apps/web` declares its viewport explicitly. Next supplies the same by default,
but without it a phone lays out at about 980 CSS pixels and scales down, which
makes every breakpoint below `lg` dead code — the state the current game ships
in.

**Not verified here**: the criterion asks for the gallery *displayed* at 360 px
and 1280 px. There is no browser in CI. What was verified is the emitted CSS of
a real build — three `min-width` media queries at the declared breakpoints, and
no fixed length above the floor anywhere in the package or the gallery. Seeing
it is a headless browser's job, and that is its own piece of work.

**Done when**: the gallery displays without horizontal overflow or overlap
at 360 px as at 1280 px.

### 6.6 — Gallery and contrast audit

The component gallery is the phase deliverable: every component exported by
the package appears in it, in both modes. Contrast audit on that rendering.

**The audit is arithmetic, not a screenshot.** WCAG 2.1 defines contrast
exactly, so it is computed from the colours rather than eyeballed — and a number
is the better artefact anyway: it says *how far* a pair is from passing, which
is what decides whether a fix is a nudge or a redesign. It runs twice, from two
sources of colour and one implementation of the maths: `contrast.test.ts` parses
`theme.css`, and the gallery reads what the browser actually painted through
`getComputedStyle`, which is what makes it an audit "on that rendering" in both
palettes.

**The completeness check is derived, not listed.** `page.test.ts` reads the
package's own exports — a capitalised name whose value is a function or carries
`$$typeof` — and holds `PRIMITIVES` to it. A component exported and never added
to the gallery fails, and so does one listed and never rendered.
