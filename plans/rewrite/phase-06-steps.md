# Phase 6 — steps: the design system

> The phase sheet, its exit gate and where each step stands:
> `phase-06-design-system.md`.

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

### 6.2 — shadcn/ui primitives

The shadcn/ui primitives installed and dressed by the theme. They bring the
accessibility groundwork — roles, focus, keyboard — that the legacy
`<span onClick>` elements lack.

**Seven, chosen for what the current interface gets wrong**, not for
completeness: `Button` (`.btn`, `.btn.primary`, `.btn.ghost`, `.btn-icon`),
`Input` (`.expert-input`), `Label` — of which the current game has *none*, a
placeholder standing in for a name and vanishing the moment anything is typed —
`Badge` (`Chip`), `Separator` (`Divider`), `Progress` (`HairProgress`) and
`Dialog`. A primitive nothing will use is a primitive nobody maintains.

Five decisions taken while writing it:

- **`Dialog` is the reason this step is not decoration.** The current modals are
  a fixed `<div>` over an overlay `<div>`: focus walks out of them into the page
  behind, Escape does nothing, the overlay is a click target with no role, and a
  screen reader is told nothing happened. Radix answers all four, and none of
  them are worth writing again.
- **`Separator` is decorative by default — the opposite of Radix.** Its
  `decorative` defaults to false, so every hairline is announced. Most are a rule
  between two paragraphs, and a screen reader saying "separator" eleven times
  down a lobby is noise. Found by a test that asserted the behaviour the
  component's own comment claimed.
- **No icon library.** The dialog's dismiss is one drawn glyph with an
  `aria-label`; a dependency for it would be a dependency for one path.
- **React is a peer dependency.** Two copies of React in one page is the oldest
  bug in the ecosystem, and a design system that ships its own is how you get
  one.
- **Every primitive is a client component**, marked whether or not it needs to
  be today: one that grows a handler and forgets the directive fails at build
  time in the application, a long way from here.

The tests drive the components the way a player without a mouse would and read
the accessibility tree, not the class names — an assertion on
`class="rounded-full"` passes on a `<span>`, which is exactly what is being
replaced. Two of them assert what a hurried refactor removes first: the focus
ring is present, and no variant carries a raw hex.

**Done when**: the selected primitives are rendered in the gallery, in both
modes, focusable and operable with the keyboard.

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

### 6.4 — Paragraph token component

The component carrying the most CSS rules in the project. Its seven visual
states (`selected`, `edited`, `scanned`, `hinted`, `found`, `missed`,
`false-positive`) and their pseudo-element badges become a component with
variants (`cva`), not a cascade of global classes. And it becomes a real
interactive element: the token **is** the central gesture of the game, and
today it is a non-focusable `<span onClick>`. Role, visible focus, keyboard
activation.

**Done when**: the seven states are rendered in the gallery, every variant
has its render test, and the token is reachable by tab and activated by
keyboard with a visible focus.

### 6.5 — Responsive

The package's components are built fluid, breakpoints defined in the theme.
There is a single media query in the whole project today.

**Done when**: the gallery displays without horizontal overflow or overlap
at 360 px as at 1280 px.

### 6.6 — Gallery and contrast audit

The component gallery is the phase deliverable: every component exported by
the package appears in it, in both modes. Contrast audit on that rendering.

**Done when**: the gallery renders all exported components and the contrast
audit passes in both modes.
