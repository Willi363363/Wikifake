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

## What L.3 wrote, and what it cost

The eight roles above are what J2 declared. The theme has **twenty-two**, and
the other fourteen had to be derived and measured rather than guessed — the
semantic ones especially, since a wrongly marked paragraph is the one moment
this game must colour.

| Token | Light | Dark | Carries |
|---|---|---|---|
| `bg-grain` | `#e2e8f1` | `#111825` | the deeper ground |
| `line-strong` | `#94a3b8` | `#64748b` | a structural edge — no longer black |
| `ink-2` | `#2f3a4a` | `#cbd5e3` | secondary prose |
| `muted-2` | `#6d798a` | `#6f7f93` | the most withdrawn text, large only |
| `accent-line` | `#0f766e` | `#2dd4bf` | focus, and selection |
| `bronze` | `#c2410c` | `#fb923c` | what a hint cost |
| `green` | `#136c34` | `#4ade80` | the FOUND verdict |
| `warn` | `#8a5400` | `#fbbf24` | the MISSED verdict |
| `danger` | `#b91c1c` | `#f87171` | WRONGLY MARKED |
| the five `-soft` | tints of the ground | tints of the ground | the debrief's rows |

**Forty-two measurements, all passing.** The tightest AA pair is `on-fill` on
`bronze` at 5.18 — ×1.15 of the threshold. Two light pairs came out at ×1.05 and
×1.09 on the first pass, which is the very thinness this sheet had just objected
to, so `muted`, `muted-2`, `green` and `warn` were darkened before anything was
written. Measuring twice cost ten minutes.

## Two guarantees this changed, and neither was dropped

**`THEME_INDEPENDENT` is now empty.** The brutalist palette used one set of
fills on both grounds, so `on-fill` and the five accents were the same colour
twice. J2's accent inverts between the themes — a blue dark enough to carry
white on paper disappears on near-black — so every fill moves. The assertion in
`contrast.test.ts` was **reversed rather than deleted**: it now requires every
fill to measure *differently* in the two palettes, which catches the same
mistake from the other side — a fill translated in one palette and forgotten in
the other.

**The brand mark lost the rule it was standing on.** A favicon is drawn once and
shown in a tab strip that does not say which palette it is in, so J.2 made it
use only theme-independent tokens. There are none now. The rule is explicit
instead: the mark wears the **light** palette's accent pair, and its test reads
the dark block to prove it drew none of it. The cost is stated rather than
hidden — the icon sits a little dark against a dark tab strip.

Four files outside the stylesheet carry hex literals because they render without
it, and all four were repainted: the crash page, the web manifest, the brand
mark and the share card. Each has a test that reads the stylesheet and compares,
which is why the palette change could not slip past them — the crash page had
once worn phase 6's colours through an entire redesign without anything failing.

## What this sheet does not decide

It measures **nine pairs a mockup happened to use**. The tokens land in L.3, and
what holds them afterwards is `CONTRAST_PAIRS` in `packages/ui`, which is the
list the design system declares and the audit walks — forty pairs today.

And `apps/web/src/fills.test.ts` is the other half, for the reason it was
written: those forty are the pairs the *design system* declares, and the pairs
a *screen* invents are out of their reach. Both lists get the new tokens, or
this measurement protects nothing.
