# Phase 6 — Design system

| | |
|---|---|
| **State** | ✅ done — the exit gate is passed, the contrast decision taken |
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

Six steps, so the definitions live in two sheets. **The tables below are the
only place that says where a step stands** — the sheets define the work and its
completion criterion, and carry no state.

| # | Step — the stylesheet | State |
|---|---|---|
| 6.1 | Tailwind v4 theme | ✅ done |
| 6.3 | Theme animations and reduced motion | ✅ done |

Definitions: `phase-06-steps-stylesheet.md`.

| # | Step — the components | State |
|---|---|---|
| 6.2 | shadcn/ui primitives | ✅ done |
| 6.4 | Paragraph token component | ✅ done |

Definitions: `phase-06-steps-components.md`.

| # | Step — how it is shown, and checked | State |
|---|---|---|
| 6.5 | Responsive | ✅ done |
| 6.6 | Gallery and contrast audit | ⚠️ delivered — see below |

Definitions: `phase-06-steps-delivery.md`.

## Exit gate

**Passed.** The one line that could not be was the contrast audit, and it could
not be because it was waiting on a decision rather than on work.

- ✅ The component gallery is rendered, all exported components included —
  derived from the package's exports, so the list cannot fall behind.
- ✅ Contrasts are audited in both modes, and **both palettes now pass every
  pair**. The light one failed seven, three below 3:1 — the current game's
  colours, inherited rather than introduced here, so correcting them was the
  redesign this phase's own pitfalls forbade a transcription from taking on its
  own. The decision was taken after the transcription closed, and the five
  solids were darkened by the smallest factor that works, hue and saturation
  untouched, no wash moved. The reasoning and the pinned ratios are in
  `packages/ui/src/contrast.test.ts`.
- ✅ `prefers-reduced-motion` neutralises shakes and stroboscopic flashes —
  seven animations to `none`, verified in a real build's CSS.
- ✅ The paragraph token is playable by keyboard, its seven states rendered and
  tested.
- ✅ No `style={{}}` object in `packages/ui`.

**The two criteria that asked to *see* something are now seen.** This sheet said
twice that `prefers-reduced-motion` and the 360 px rendering rested on reading
the emitted CSS because there was no browser in CI. Step 9.5 brought one, and
`apps/e2e/specs/accessibility.spec.ts` asks both questions of a browser that
painted the page: the seven reducible animations resolve to `none` under the
preference and to something else without it, and `/`, `/play` and `/gallery`
do not scroll sideways at 360 px.

The unit suites stay. They fail in a second and they say which line of which
stylesheet is wrong, which a journey cannot. What the journey adds is that the
rule *applied* — and the second reduced-motion test is there because a theme
shipping `none` unconditionally would satisfy the first while neutralising
nothing.

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
