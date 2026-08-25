# Phase 6 — Design system

| | |
|---|---|
| **State** | in progress — two steps done |
| **Branch** | `feat/rewrite-phase-6` |
| **Depends on** | phase 1 |
| **Delivers** | `packages/ui`: theme, primitives, animations, token component |

## Objective

Transcribe the current visual identity into a design system: the tokens of
`tokens.css` ("warm paper" palette, five accents, shadows, radii) become a
Tailwind v4 theme, the primitives come from shadcn/ui, the ~15 shared
keyframes become theme animations, and the visual state machine of the
paragraph token becomes a component with variants. Transcribe, not rethink.

## Why now

This phase depends on no server phase — only on the types from phase 1 —
and can therefore move forward in parallel with phases 2 to 5. The frontend
phases that follow consume its building blocks: without them, every screen
would reinvent its styles as today (~430 `style={{}}` objects, a single
media query in the whole project). This is also where the non-negotiables
are added: `prefers-reduced-motion` — the game chains shakes and
stroboscopic flashes, the photosensitivity stake is real —, dark mode,
responsiveness and accessibility.

## Steps

### 6.1 — Tailwind v4 theme ✅

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

### 6.2 — shadcn/ui primitives ✅

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

## Exit gate

- The component gallery is rendered, all exported components included.
- Contrasts are audited in both modes.
- `prefers-reduced-motion` neutralises shakes and stroboscopic flashes.
- The paragraph token is playable by keyboard, its seven states rendered
  and tested.
- No `style={{}}` object in `packages/ui`.

## Contract touched

No game logic in this package, so few server guarantees. Still see
`01-contract-to-preserve.md`: **compliance** (CC BY-SA attribution
"deliberately altered text" + licence + link, visible during and after the
round; `lang="fr"`) constrains the components that will carry it; and
**server authority** bounds the token component: its `found`, `missed` and
`false-positive` states only exist with the solution, hence after the round
ends — the component must require nothing before that.

## Pitfalls

- **No redesign.** The current visual identity is transcribed, not
  rethought. Any visual "improvement" is out of scope.
- **Do not port the dead components**: `HintsPanel` and the sidebar variant
  of `Leaderboard` do not make the trip.
- **Building blocks, not screens.** The ~430 `style={{}}` objects of the
  current frontend fall in the frontend phases that follow, not here.
- **`prefers-reduced-motion` targets the "signature" animations.** Those
  are precisely the shakes and the flashes, not only the soft transitions,
  that it must neutralise.
- **A forgotten token state will show up mid-round**, not in the gallery:
  the state combinations and the badges justify the per-variant render
  test.
