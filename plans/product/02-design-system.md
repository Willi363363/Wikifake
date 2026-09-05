# Track B — the design system, rebuilt on the new direction

| | |
|---|---|
| **State** | ⬜ not started |
| **Branch** | `feat/design-system-v2` |
| **Depends on** | track A |
| **Delivers** | `packages/ui` carrying the brutalist direction, audit green |

## Objective

Land `01-art-direction.md` in code. The token *architecture* of phase 6 is
kept — tokens as data, a themed stylesheet, a contrast audit over declared
pairs, a gallery generated from the token list. Only the values, the grammar
and two now-obsolete tokens change.

## Why the architecture survives a full redesign

Because phase 6 built it to. `COLOUR_TOKENS` is a list of names and roles;
`theme.css` holds the values; `theme.test.ts` holds the two to each other, so
a token added without a value fails rather than renders wrong. `auditContrast`
reads the stylesheet through a `ReadColour` function and grades declared pairs.

The consequence worth stating: **this redesign is a value swap and a primitive
restyle, not a rewrite.** An estimate that says otherwise has misread the
package. What genuinely changes shape is small — `glass` and `glass-strong`
disappear, and the shadow scale stops meaning elevation and starts meaning
offset distance.

## Steps

| # | Step | State |
|---|---|---|
| B.1 | Palette: choose the exact values, both themes | ⬜ |
| B.2 | `theme.css` — the two palettes, and `glass*` removed | ⬜ |
| B.3 | Contrast audit re-run, adjusted, and re-pinned | ⬜ |
| B.4 | Type scale and the single grotesque family | ⬜ |
| B.5 | Borders, radii, offset shadows | ⬜ |
| B.6 | Primitives restyled — button, badge, dialog, input, progress | ⬜ |
| B.7 | The reading sheet, as its own component | ⬜ |
| B.8 | Paragraph token — brutalist states, calm prose | ⬜ |
| B.9 | Motion: the collapse, and the reduced-motion path | ⬜ |
| B.10 | Gallery updated, and read on a phone | ⬜ |

### B.1 — Palette

Anchors are given by track A: ink, paper, and the two brights. What this step
decides is the verdict trio (`green`, `warn`, `danger`) and their washes, as
flat fills carrying ink text. **Choose them against the audit, not against a
screenshot** — phase 6 lost a week to a palette that looked right and failed
seven pairs, and its worst offender was the debrief's MISSED verdict at 2.56.

### B.3 — The audit is the gate, not the formality

`CONTRAST_PAIRS` is a declared list; every pair must pass, and the pinned
ratios in `contrast.test.ts` are replaced with the new measured ones. Two
rules from track A are enforced here rather than remembered:

- No bright colour is used as text on a light surface. If a pair does that,
  the pair is wrong, not the threshold.
- The reading sheet's prose pair is held above 12:1 in both palettes. It is
  the one surface where the player is asked to concentrate.

**A pair that fails is repaired by moving the colour, not by removing the
pair.** Deleting a row from `CONTRAST_PAIRS` to get a green test is the exact
move `plans/method/02-repository-rules.md` forbids.

### B.7 — The reading sheet

A component, so the exemption in track A is enforced by construction instead
of by discipline. It owns the measure, the line height, the prose colours, and
it accepts no border, fill or shadow prop. Every screen that shows article
text uses it — the round, the debrief, the solo game.

If a designer later wants the article in a yellow box, they have to delete a
component to do it, and the deletion shows up in review. That is the point.

### B.9 — Motion

The direction leans on motion, so `prefers-reduced-motion` is tested in this
step and not at the end. Each animation resolves instantly to its end state
under the preference; no state is conveyed by movement alone. `motion.test.ts`
already holds the pattern.

## Exit gate

- The gallery renders every token, primitive and paragraph-token state, in
  both palettes, and is legible at 360px wide.
- `contrast.test.ts` is green with newly pinned ratios, no pair removed.
- No `glass` token, no gradient, and no blurred shadow remains in the package.
- `pnpm test`, `typecheck`, `lint` and `build` green — forced past the Turbo
  cache, per `HANDOVER.md`.
