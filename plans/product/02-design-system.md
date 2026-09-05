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
| B.1 | Transcribe both palettes from `01-palette.md` | ⬜ |
| B.2 | `glass*` removed, `on-fill` added, `accent-line` re-roled | ⬜ |
| B.3 | `CONTRAST_PAIRS` rewritten, forty ratios re-pinned | ⬜ |
| B.4 | Type scale and the single grotesque family | ⬜ |
| B.5 | Borders, radii, offset shadows | ⬜ |
| B.6 | Primitives restyled — button, badge, dialog, input, progress | ⬜ |
| B.7 | The reading sheet, as its own component | ⬜ |
| B.8 | Paragraph token — brutalist states, calm prose | ⬜ |
| B.9 | Motion: the collapse, and the reduced-motion path | ⬜ |
| B.10 | Gallery updated, and read on a phone | ⬜ |

### B.1 — Transcription, not choice

**Track A already chose the values and measured them.** `01-palette.md` holds
both palettes and the forty ratios they produce, so this step copies numbers
character for character and the next step proves the copy.

The three structural changes that come with them, all defined in that sheet:
`glass` and `glass-strong` are deleted, `on-fill` is added — black in both
palettes, the text colour on a saturated fill — and `accent-line` stops being
the accent's border and becomes the focus and selection colour.

`on-fill` is the one to understand before typing anything. The fills do not
change between themes; `ink` does. Text on a fill therefore cannot be `ink`,
or a dark-mode button puts white on yellow at 1.30:1.

### B.3 — The audit is the gate, not the formality

`CONTRAST_PAIRS` is rewritten to the twenty rows of `01-palette.md`: the three
`glass` rows go with the token they measured, and the accent rows are
re-expressed as `on-fill` on each fill and `ink` on each wash. The measured
ratios are then pinned in `contrast.test.ts`, as the current test pins its own.

**A number that disagrees with the sheet means the transcription is wrong**,
not that the target is. That is the whole reason track A measured before track
B typed.

Two rules from track A are enforced here rather than remembered:

- No bright colour is used as text on a light surface. If a pair does that,
  the pair is wrong, not the threshold.
- The reading sheet's prose pair stays above 12:1 in both palettes. It is
  measured at 21.00 and 15.51, so the margin exists — it is there to be kept,
  not spent.

**A pair that fails is repaired by moving the colour, not by removing the
pair.** Deleting a row from `CONTRAST_PAIRS` to get a green test is the exact
move `plans/method/02-repository-rules.md` forbids. Removing the `glass` rows
is not that, and `01-palette.md` says why in as many words.

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
