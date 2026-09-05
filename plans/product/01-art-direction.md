# Track A — the art direction

**Decision: playful neo-brutalism.** Flat saturated fills, heavy borders, hard
offset shadows, a very bold grotesque. Chosen over three alternatives —
editorial print, forensic laboratory, glitch — on 2026-09-05.

**Why this one.** It is memorable in a screenshot, and a screenshot is how this
game gets shared. It reads in one second on a phone. It is cheap to hold to,
because its rules are mechanical: a border is 3px or it is wrong.

**What it costs, stated now rather than discovered later.** This is a dated
style; expect it to look of-its-moment within about two years. It is also
actively hostile to long-form reading — and this game's core screen is a
Wikipedia article of several hundred words. That conflict is not a detail to
resolve later. It is resolved below, and the resolution is the most important
paragraph in this file.

## The reading surface is exempt

**The brutalist grammar applies to the chassis, never to the text being
judged.**

- **Chassis** — navigation, buttons, HUD, timers, scores, badges, dialogs,
  the lobby, the debrief, the landing page. Full brutalist treatment.
- **Reading surface** — the article's paragraphs, and only those. A calm
  sheet: generous measure (60–75 characters), 1.6 line height, near-black on
  near-white, no border, no shadow, no fill. It is the one place on the site
  that looks like nothing.

The reason is not taste. The player's task is to detect a factual anomaly in
prose. Every unit of visual noise around that prose is noise the player has to
filter before they can do the thing the game is for. A paragraph in a 3px box
with a yellow fill is a paragraph nobody reads carefully.

**The interaction with the paragraph stays brutalist.** Selecting one gives it
the hard border and the offset shadow; the verdict chips at the debrief are
flat fills. The prose is calm — the *act of marking it* is loud. That contrast
is the design, not a compromise in it.

## The grammar

Mechanical rules, so that "is this on-brand" has an answer rather than an
opinion:

| Element | Rule |
|---|---|
| Border | 3px solid ink. Never a hairline, never a colour-on-colour border. |
| Radius | 0 on the chassis. The one exception is the paragraph token: 4px. |
| Shadow | Hard offset only — `4px 4px 0 var(--color-ink)`. No blur, ever. |
| Fill | Flat. **No gradient anywhere**, no glass, no translucency. |
| Display type | Grotesque, 800 weight, tight tracking, generous size. |
| Body type | The same family at 400. One family total, two weights. |
| Motion | Fast and hard: 120–180ms, `steps()` or a sharp cubic-bezier. No spring, no bounce, no fade-in-on-scroll as decoration. |
| Hover | The shadow collapses and the element shifts 2px into it. Nothing else moves. |

Two tokens in the current stylesheet — `glass` and `glass-strong` — describe
translucent surfaces. **They are removed by this direction**, not recoloured.
Track B handles the deletion and whatever referenced them; `01-palette.md`
records why removing their contrast pairs is bookkeeping rather than
disarming a check.

## The palette

**Decided and measured. The values are in `01-palette.md`**, together with the
forty measurements that justify them — track B transcribes that sheet rather
than choosing anything.

The anchors:

```
ink        #000000    body text, and the structural 3px border
paper      #FFFCF2    the page
accent     #FFE14D    the yellow — the primary action
focus      #00E5FF    the cyan — focus, selection, the player's own marks
```

The game's verdict colours survive as flat fills: `green` = found,
`warn` = missed, `danger` = wrong, and `bronze` = a hint that was paid for.

**The fills are the same colour in both palettes.** A yellow button is that
yellow on a dark page too; what a theme switches is the ground, the text and
the washes. That is why `01-palette.md` adds a token — `on-fill`, black in
both — for text sitting on a fill, and it is the mechanism behind the rule
below rather than a detail of it.

### The one hard colour rule

**Text on a bright fill is always ink, never paper.** Measured, not assumed:

| Pair | Ratio | Verdict |
|---|---|---|
| `#000000` on `#FFE14D` | 16.1:1 | passes everything |
| `#FFFFFF` on `#FFE14D` | 1.30:1 | unreadable |
| `#000000` on `#00E5FF` | 13.7:1 | passes everything |
| `#FFFFFF` on `#00E5FF` | 1.54:1 | unreadable |

The brights are *fills*, and they are never used as text on a light surface.
A yellow word on the paper background is 1.3:1 — invisible. This single rule
is what makes a saturated palette pass an accessibility audit at all, and it
is the rule a redesign quietly breaks first.

## The dark palette

The repository ships two palettes and a viewer can be in either, so the
direction has to answer for both. Dark brutalism inverts the ground, not the
logic: paper becomes near-black, ink becomes near-white, borders become the
light colour, and **the brights keep ink text** — a yellow fill still carries
black type on a dark page, because the fill is not what changed.

The reading sheet in dark mode is a slightly raised near-black with
near-white prose. Still no border, still no fill.

## Motion, and the preference that overrides it

`packages/ui/src/motion.ts` already honours `prefers-reduced-motion`, and this
direction leans on motion harder than the last one did — so the reduced-motion
path is not a fallback to test at the end. **Every animation in this direction
is decorative by construction**: the shadow collapse, the scroll scene of
track C, the verdict reveal. With the preference set, each resolves instantly
to its end state. Nothing conveys information through movement alone.

## Exit condition

Track A decides; it does not draw. The gallery, the pinned ratios and the
restyled primitives are track B's exit gate, and the side-by-side screenshot
test is track D's — putting them here would mean track A could not close until
two other tracks had.

Track A is done when:

1. This file is agreed.
2. **Every token has a value in both palettes** — `01-palette.md`.
3. **Every pair the direction declares passes, measured**, with the numbers
   recorded so that a transcription error shows up as a disagreement rather
   than as a discovery. Done: forty measurements, all passing, tightest
   margin ×1.54.
4. The token changes are named — removed, added, re-roled — so that track B
   transcribes rather than decides.

What is deliberately **not** settled here: the type family. The direction
names a bold grotesque and the choice of which one is a licensing and
loading-cost decision that belongs with the work that loads it, in step B.4.
