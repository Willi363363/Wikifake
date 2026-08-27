# Phase 6 — steps: the stylesheet

> Steps 6.1 and 6.3 — what the design system *is*, before anything uses it.
> The phase sheet, its exit gate and where each step stands:
> `phase-06-design-system.md`. The components:
> `phase-06-steps-components.md`.

### 6.1 — Tailwind v4 theme

The tokens of `tokens.css` transcribed into the theme: palette, five
accents, shadows, radii. A dark variant of the tokens — dark mode is one of
the non-negotiable additions.

Five decisions taken while writing it:

- **`@theme static`, not `@theme`.** Tailwind emits only the theme variables it
  can see a utility using. For an application that is right; for a design system
  it is a trap, because a colour read through `var(--color-…)` — a swatch built
  from a name, a component picking its colour at runtime — is invisible to it.
  Not hypothetical: the first build of this theme shipped **eight colours out of
  twenty-two**, and the failure was a transparent swatch rather than an error.
- **The theme does not import Tailwind.** `packages/ui` ships tokens and no
  framework; the application assembles the two, in the order it chooses.
  Importing the framework from inside the theme gives every consumer a copy of
  Tailwind's layers in an order it did not pick.
- **Dark mode follows a class as well as the system preference.** The gallery
  has to show both palettes at once, which `prefers-color-scheme` alone cannot
  do: it is one global answer per machine, and half of what this phase delivers
  is the comparison.
- **The gallery renders the package's own lists.** A gallery edited by hand
  whenever a token is added stops being complete on the first token somebody
  forgets. `tokens.ts` is the list, `theme.test.ts` holds it to the stylesheet,
  and "every token is shown" is true by construction.
- **The dark palette is a translation of the same roles**, not a second
  identity: warm paper becomes warm dark, the ink inverts, the five accents are
  lightened just enough to stay legible. The corners do not move — they are
  geometry, not light — and the elevations do, because a light haze is invisible
  on a dark ground.

This step also gives the application its first page: until now `apps/web` served
routes and nothing else, so `app/layout.tsx` is new. It carries `lang="fr"`
(C6.3) and nothing else — the screens are phases 7 and 8.

**Done when**: every token of `tokens.css` has its named equivalent in the
theme, and a gallery page renders the palette in both modes.

### 6.3 — Theme animations and reduced motion

The ~15 shared keyframes of `animations.css`, today referenced by string
from inline styles, become theme animations, typed.
`prefers-reduced-motion` neutralises shakes and stroboscopic flashes: this
is a photosensitivity stake, not a comfort.

**It is a real hazard, and the numbers are worth writing down.** The current
game ships **no** `prefers-reduced-motion` rule anywhere, and:

- `screen-flash` and `lightning-zap` run at `0.45s infinite` with two peaks per
  cycle — about **4.4 flashes a second**, against a threshold of three;
- `static-glitch` displaces the article at `0.1s infinite` — 10 Hz;
- `shake` displaces it at `0.15s infinite` — about 7 Hz.

Four decisions taken while writing it:

- **Neutralised by name, by redefining each variable, not by a blanket
  `animation: none !important`.** The blanket rule reads as safer and is not: it
  also kills the fades — a fade is not motion, and removing them makes every
  state change snap — and it *still* misses an inline `animation:` written as a
  string, which is how the current game applies all eighteen. Seven go to
  `none`: three flashes, four displacements.
- **The classification is data and it is checked.** `MOTIONS` says what each
  animation does, and a test asserts that everything of kind `flash` or
  `displace` is reducible and nothing else is — so the judgement cannot drift
  from the stylesheet.
- **Two keyframes are not ported.** `ring-progress` and `drift` are defined in
  the legacy stylesheet and referenced by nothing at all; a transcription is not
  the place to carry dead CSS across, and the test names them so the next reader
  does not wonder whether they were forgotten.
- **The gallery does not play them at anybody.** The fades run; the seven
  hazardous ones sit still behind a button. With the preference set the buttons
  do nothing, which is the demonstration.

One trap, and it is the same shape as 6.1's: the gallery builds its class from
the animation's own name, which is invisible to a scanner that reads source as
text. The utilities are safelisted with `@source inline(...)` in the
application's stylesheet and a test holds that list to `MOTIONS` — without it
they are absent from the build and the failure is a card that sits still.

**Not verified here**: the criterion asks for the preference emulated in a
browser, and there is no browser in this repository's CI. What was verified is
the emitted CSS of a real build — sixteen keyframes, sixteen `animate-*`
utilities, each compiling to `animation: var(--animate-…)`, and a
`@media (prefers-reduced-motion: reduce)` block setting exactly the seven to
`none`. A browser check wants a headless browser in CI, which is its own piece
of work.

**Done when**: every ported keyframe is named in the theme, and the gallery
rendered with `prefers-reduced-motion` active plays neither shake nor flash
(verified by emulating the preference in the browser).
