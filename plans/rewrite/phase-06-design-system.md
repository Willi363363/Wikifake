# Phase 6 — Design system

| | |
|---|---|
| **State** | to do |
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

### 6.1 — Tailwind v4 theme

The tokens of `tokens.css` transcribed into the theme: palette, five
accents, shadows, radii. A dark variant of the tokens — dark mode is one of
the non-negotiable additions.

**Done when**: every token of `tokens.css` has its named equivalent in the
theme, and a gallery page renders the palette in both modes.

### 6.2 — shadcn/ui primitives

The shadcn/ui primitives installed and dressed by the theme. They bring the
accessibility groundwork — roles, focus, keyboard — that the legacy
`<span onClick>` elements lack.

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
