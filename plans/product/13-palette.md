# Track L — J2, measured before any CSS moved

The record of **L.2**. `13-ui-overhaul.md` keeps the track's frame and its step
table.

## Why this sheet exists at all

Phase 6 shipped a palette that looked right and failed seven contrast pairs.
Track A measured forty pairs first and shipped none. The difference in cost was
an hour against a session, and it is the only reason this step exists between
choosing a direction and writing its tokens.

**The numbers below are arithmetic, not opinion.** They are computed by
`packages/ui/src/contrast.ts` — the same functions the gallery's audit uses, on
the same definition of WCAG 2.1 — so the figure a token gets here is the figure
it will get when the audit reads it out of the stylesheet.

## The draft

| Token | Light | Dark | What it is |
|---|---|---|---|
| `bg` | `#EEF1F6` | `#0B0F17` | the page |
| `surface` | `#FFFFFF` | `#141B26` | a tile, and the reading sheet |
| `line` | `#DDE3EC` | `#1F2A38` | edges, where J2 still has one |
| `ink` | `#111827` | `#E8EDF4` | prose |
| `muted` | `#5B6675` | `#8494A8` | secondary text |
| `accent` | `#2557E6` | `#4C82F7` | actions, and nothing else |
| `onAccent` | `#FFFFFF` | `#060B14` | what sits on the accent |
| `second` | `#C2410C` | `#F59E0B` | a reward, once per screen |

## Measured, both themes

AA is 4.5:1 for normal text. Every pair passes.

| Pair | Light | Dark | What it carries |
|---|---|---|---|
| `ink` on `surface` | **17.74** | **14.70** | the article's prose — the widest margin, spent on purpose |
| `ink` on `bg` | 15.67 | 16.30 | body text on the page |
| `muted` on `surface` | 5.83 | 5.58 | secondary text in a tile |
| `muted` on `bg` | 5.15 | 6.19 | secondary text on the page |
| `onAccent` on `accent` | 5.86 | 5.48 | the play button, and every filled tile |
| `accent` on `surface` | 5.86 | **4.81** | a link inside a tile |
| `accent` on `bg` | 5.17 | 5.34 | a link on the page |
| `second` on `surface` | 5.18 | 8.05 | a reward figure |
| `ink` on `line` | 13.75 | 12.34 | text on a hairline, if one is ever filled |

## The one finding

**`accent` on `surface` in the dark theme is 4.81, and that is too close.**

It passes — AA is 4.5 — but the margin is ×1.07 where track A's tightest was
×1.54. A pair that thin is a pair that fails the next time somebody darkens a
tile by a shade, and nothing will announce it: the audit will still be green
until it suddenly is not.

Measured alternatives, all of them the same hue:

| Dark accent | on `surface` | on `bg` | `onAccent` on it |
|---|---|---|---|
| `#4C82F7` — the draft | 4.81 | 5.34 | 5.48 |
| `#5A8CF8` | 5.39 | 5.97 | 6.14 |
| **`#6A97F9`** | **6.10** | 6.77 | 6.95 |
| `#7BA5FA` | 7.08 | 7.86 | 8.07 |

**`#6A97F9` is the recommendation**: ×1.36 of AA on the tightest pair, a margin
that survives a shade of drift, and still unmistakably the same blue. `#7BA5FA`
buys more room and starts to look washed on a dark ground, which is the reason
not to take the largest number available.

The light accent needs nothing — `#2557E6` is 5.86 both ways — but `#1E4FD8`
(6.63) is there if the two themes are ever wanted at matching margins.

## What this sheet does not decide

It measures **nine pairs a mockup happened to use**. The tokens land in L.3, and
what holds them afterwards is `CONTRAST_PAIRS` in `packages/ui`, which is the
list the design system declares and the audit walks — forty pairs today.

And `apps/web/src/fills.test.ts` is the other half, for the reason it was
written: those forty are the pairs the *design system* declares, and the pairs
a *screen* invents are out of their reach. Both lists get the new tokens, or
this measurement protects nothing.
