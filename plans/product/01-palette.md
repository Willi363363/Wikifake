# Track A — the palette, and what it changes about the tokens

The values, measured. `01-art-direction.md` says what the direction is; this
sheet is what track B transcribes, so that B copies numbers rather than
inventing them.

Every pair below was measured with `packages/ui/src/contrast.ts` — the same
functions CI runs — before this file was written. **The palette was chosen
against the audit, not against a screenshot.**

## Three changes to the token set

**`glass` and `glass-strong` are removed.** The direction has no translucent
surface. This is a token that ceases to exist, not one that gets a new value,
and the three contrast pairs that referenced it go with it.

That removal needs saying out loud, because `02-design-system.md` forbids
deleting a pair to get a green test. The distinction: a pair is deleted when
**the thing it measured is gone from the design**, and never when the colours
in it fail. One is bookkeeping, the other is disarming the check.

**`on-fill` is added: `#000000`, in both palettes.** It is the text colour on
a saturated fill, and it is the token that makes the direction's one hard rule
enforceable.

The problem it solves is specific. `ink` inverts between themes — near-black
on light, near-white on dark. The fills do not: a yellow button is the same
yellow on a dark page. So text on a fill cannot be `ink`, or it turns white on
yellow in dark mode and lands at 1.30:1. `on-fill` is black in both palettes,
because the fill it sits on is the same colour in both.

**`accent-line` is re-roled**, from "the accent's border" to the **focus and
selection colour** — the cyan. Borders are `line-strong` in this direction and
there is nothing left for a per-accent border to do, while focus needs a
colour that is never used for anything else.

## The fills — identical in both palettes

This is the structural decision of the palette. A fill is a flat block of
colour with black text on it, and it does not change when the theme does.

| Token | Value | What it is |
|---|---|---|
| `accent` | `#FFE14D` | the primary action |
| `accent-line` | `#00E5FF` | focus, selection, the player's own marks |
| `bronze` | `#C9A7FF` | a hint — the thing you pay for |
| `green` | `#5FE08B` | FOUND |
| `warn` | `#FFB020` | MISSED |
| `danger` | `#FF5C5C` | WRONGLY MARKED |

`bronze` is a lavender rather than the metal its name suggests. The name is
kept because it is what the code, the tests and the paragraph-token states
already call it, and renaming a token across the repository to match a hue is
a much larger diff than living with an inherited name. What it means — *a
hint, which is paid for* — is unchanged.

Why lavender: the three verdicts occupy green, amber and coral, and a warm
hint colour would sit between two of them. Purple is the only direction with
room left.

## Light

```
bg            #FFFCF2     bg-grain      #F2EEE0     surface       #FFFFFF
line          #DAD4C2     line-strong   #000000
ink           #000000     ink-2         #2E2C27
muted         #57544B     muted-2       #6F6B60     on-fill       #000000
accent-soft   #FFF6CC     bronze-soft   #EFE6FF     green-soft    #DBF7E6
warn-soft     #FFEBC7     danger-soft   #FFDEDE
```

## Dark

```
bg            #12110E     bg-grain      #1A1815     surface       #1C1A16
line          #3A362E     line-strong   #F5F2E8
ink           #F5F2E8     ink-2         #D5D0C2
muted         #A9A395     muted-2       #8B8577     on-fill       #000000
accent-soft   #3A3212     bronze-soft   #2A2340     green-soft    #14301F
warn-soft     #3A2A0C     danger-soft   #3A1717
```

`line` is an internal divider inside a card; `line-strong` is the structural
3px border. They are far apart on purpose — in this direction the structural
border is the design, and a hairline that tried to be both would weaken it.

## Measured

Twenty pairs, both palettes, forty measurements. All pass.

| Pair | Needs | Light | Dark |
|---|---|---|---|
| `ink` on `bg` — body text on the page | 4.5 | 20.46 | 16.86 |
| `ink` on `surface` — body text on a card | 4.5 | 21.00 | 15.51 |
| `ink` on `bg-grain` — the deeper ground | 4.5 | 18.08 | 15.82 |
| `ink-2` on `bg` — secondary text | 4.5 | 13.59 | 12.26 |
| `ink-2` on `surface` | 4.5 | 13.95 | 11.28 |
| `muted` on `bg` — labels and captions | 4.5 | 7.37 | 7.52 |
| `muted` on `surface` | 4.5 | 7.57 | 6.92 |
| `muted-2` on `bg` — large text only | 3 | 5.18 | 5.14 |
| `muted-2` on `surface` — large only | 3 | 5.32 | 4.73 |
| `on-fill` on `accent` — the primary button | 4.5 | 16.13 | 16.13 |
| `on-fill` on `accent-line` — a focused control | 4.5 | 13.65 | 13.65 |
| `on-fill` on `bronze` — a hint chip | 4.5 | 10.45 | 10.45 |
| `on-fill` on `green` — FOUND | 4.5 | 12.52 | 12.52 |
| `on-fill` on `warn` — MISSED | 4.5 | 11.48 | 11.48 |
| `on-fill` on `danger` — WRONGLY MARKED | 4.5 | 6.94 | 6.94 |
| `ink` on `accent-soft` — a marked paragraph | 4.5 | 19.31 | 11.40 |
| `ink` on `bronze-soft` — a hinted paragraph | 4.5 | 17.43 | 13.27 |
| `ink` on `green-soft` — the FOUND row | 4.5 | 18.46 | 12.73 |
| `ink` on `warn-soft` — the MISSED row | 4.5 | 17.96 | 12.36 |
| `ink` on `danger-soft` — the WRONGLY MARKED row | 4.5 | 16.76 | 14.26 |

**The tightest margin is ×1.54** — `on-fill` on `danger`, at 6.94 against a
target of 4.5. `danger` is the darkest fill, and darkening it further to look
more alarming is the change that would break this row first.

The reading sheet's own pair — `ink` on `surface` — is 21.00 and 15.51, well
clear of the 12:1 floor `02-design-system.md` asks for. That surface is where
the player is asked to concentrate, and it is the one place in the palette
with margin to spare on purpose.

## Colour is never the only carrier

The three verdicts are green, amber and coral. Under deuteranopia — the
commonest form of colour blindness — `green` at luminance 0.576 and `warn` at
0.524 are close enough to be difficult to tell apart, and no choice of hue
fixes that while keeping three warm-to-cool verdicts distinguishable for
everybody else.

So the constraint is on the components rather than the palette: **FOUND,
MISSED and WRONGLY MARKED always carry their word**, and the debrief is
readable with every fill rendered grey. The same holds for the paragraph
token, whose states are already shape-and-border as well as colour.

This is a rule for track D to hold, and a thing to check rather than assume
when the debrief is drawn.

## What track B does with this

1. Transcribe both palettes into `theme.css`, character for character.
2. Delete `glass` and `glass-strong`, and add `on-fill` to `COLOUR_TOKENS`.
3. Rewrite `CONTRAST_PAIRS` to the twenty rows above — the three `glass` rows
   removed with the token, and the accent rows re-expressed as `on-fill` on
   each fill and `ink` on each wash.
4. Pin the forty ratios in `contrast.test.ts`, as the current test pins its own.

A number here that disagrees with the number CI measures means the
transcription is wrong, and the test is what says so.
